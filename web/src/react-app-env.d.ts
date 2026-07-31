/// <reference types="react-scripts" />
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'bootstrap-icons/font/bootstrap-icons.css' {
  const content: { [className: string]: string };
  export default content;
}