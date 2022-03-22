/*
 * SPDX-FileCopyrightText: 2020 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: ISC
 */

// Markdown-it plugin to render GitHub-style task lists; see
//
// https://github.com/blog/1375-task-lists-in-gfm-issues-pulls-comments
// https://github.com/blog/1825-task-lists-in-all-markdown-documents

import MarkdownIt from 'markdown-it/lib';
import StateCore from 'markdown-it/lib/rules_core/state_core';
import Token from 'markdown-it/lib/token';

interface TaskListsOptions {
  enabled: boolean;
  label: boolean;
  lineNumber: boolean;
}

const checkboxRegex = /^ *\[([ x])\] /i;

export default function markdownItTaskLists(
  md: MarkdownIt,
  options: TaskListsOptions = { enabled: true, label: true, lineNumber: false }
): void {
  md.core.ruler.after('inline', 'github-task-lists', (state) => processToken(state, options));
  md.renderer.rules.taskListItemCheckbox = (tokens) => {
    const token = tokens[0];
    const checkedAttribute = token.attrGet('checked') ? 'checked=""' : '';
    const disabledAttribute = token.attrGet('disabled') ? 'disabled=""' : '';
    const id = token.attrGet('id');
    const line = token.attrGet('line');
    const idAttribute = `id="${id}"`;
    const dataLineAttribute = line && options.lineNumber ? `data-line="${line}"` : '';

    return `<label contenteditable="false"><input class="task-list-item-checkbox" type="checkbox" ${checkedAttribute} ${disabledAttribute} ${dataLineAttribute} ${idAttribute}"><span></span></label>`;
  };

  md.renderer.rules.taskListItemLabel_close = () => {
    return '</p></div>';
  };

  md.renderer.rules.taskListItemLabel_open = (tokens) => {
    const token = tokens[0];
    const id = token.attrGet('id');
    return `<div><p>`;
  };
}

function attrSet(token, name, value) {
  var index = token.attrIndex(name);
  var attr = [name, value];

  if (index < 0) {
    token.attrPush(attr);
  } else {
    token.attrs[index] = attr;
  }
}

function processToken(state: StateCore, options: TaskListsOptions): boolean {
  const allTokens = state.tokens;

  attrSet(allTokens[0], 'class', 'contains-task-list');

  for (let i = 2; i < allTokens.length; i++) {
    if (!isTodoItem(allTokens, i)) {
      continue;
    }

    const { isChecked } = todoify(allTokens[i], options);
    allTokens[i - 2].attrJoin('class', `task-list-item`);
    allTokens[i - 2].attrJoin('data-checked', isChecked ? `true` : `false`);

    const parentToken = findParentToken(allTokens, i - 2);
    if (parentToken) {
      parentToken.attrJoin('class', 'task-list');
    }
  }
  return false;
}

function findParentToken(tokens: Token[], index: number): Token | undefined {
  const targetLevel = tokens[index].level - 1;
  for (let currentTokenIndex = index - 1; currentTokenIndex >= 0; currentTokenIndex--) {
    if (tokens[currentTokenIndex].level === targetLevel) {
      return tokens[currentTokenIndex];
    }
  }
  return undefined;
}

function isTodoItem(tokens: Token[], index: number): boolean {
  return (
    isInline(tokens[index]) &&
    isParagraph(tokens[index - 1]) &&
    isListItem(tokens[index - 2]) &&
    startsWithTodoMarkdown(tokens[index])
  );
}

function todoify(token: Token, options: TaskListsOptions) {
  if (token.children == null) {
    return;
  }

  const id = generateIdForToken(token);

  const { checkbox, isChecked } = createCheckboxToken(token, options.enabled, id);
  token.children.splice(0, 0, checkbox);
  token.children[1].content = token.children[1].content.replace(checkboxRegex, '');

  if (options.label) {
    token.children.splice(1, 0, createLabelBeginToken(id));
    token.children.push(createLabelEndToken());
  }

  return { isChecked };
}

function generateIdForToken(token: Token): string {
  if (token.map) {
    return `task-item-${token.map[0]}`;
  } else {
    return `task-item-${Math.ceil(Math.random() * (10000 * 1000) - 1000)}`;
  }
}

function createCheckboxToken(token: Token, enabled: boolean, id: string): Token {
  const checkbox = new Token('taskListItemCheckbox', '', 0);
  if (!enabled) {
    checkbox.attrSet('disabled', 'true');
  }
  if (token.map) {
    checkbox.attrSet('line', token.map[0].toString());
  }

  checkbox.attrSet('id', id);

  const checkboxRegexResult = checkboxRegex.exec(token.content);
  const isChecked = !!checkboxRegexResult && checkboxRegexResult[1].toLowerCase() === 'x';
  if (isChecked) {
    checkbox.attrSet('checked', 'true');
  }

  return { checkbox, isChecked };
}

function createLabelBeginToken(id: string): Token {
  const labelBeginToken = new Token('taskListItemLabel_open', '', 1);
  labelBeginToken.attrSet('id', id);
  return labelBeginToken;
}

function createLabelEndToken(): Token {
  return new Token('taskListItemLabel_close', '', -1);
}

function isInline(token: Token): boolean {
  return token.type === 'inline';
}

function isParagraph(token: Token): boolean {
  return token.type === 'paragraph_open';
}

function isListItem(token: Token): boolean {
  return token.type === 'list_item_open';
}

function startsWithTodoMarkdown(token: Token): boolean {
  return checkboxRegex.test(token.content);
}
