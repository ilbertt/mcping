export function requireChild<T extends Element>(options: {
  root: ParentNode;
  selector: string;
}): T {
  const element = options.root.querySelector<T>(options.selector);
  if (!element) {
    throw new Error(`Missing element: ${options.selector}`);
  }
  return element;
}

export function requireElement<T extends Element>(selector: string): T {
  return requireChild<T>({ root: document, selector });
}

export function actionButton(options: { card: HTMLElement; action: string }): HTMLButtonElement {
  return requireChild<HTMLButtonElement>({
    root: options.card,
    selector: `[data-action="${options.action}"]`,
  });
}
