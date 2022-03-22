import { Node } from './Node';
export class Paragraph extends Node {
  type = 'paragraph';

  matching() {
    return this.DOMNode.nodeName === 'P';
  }
}
