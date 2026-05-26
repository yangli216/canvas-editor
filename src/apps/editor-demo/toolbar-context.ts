export interface IEditorDemoToolbarContext {
  undoDom: HTMLDivElement
  redoDom: HTMLDivElement
  painterDom: HTMLDivElement
  fontOptionDom: HTMLDivElement
  fontSelectDom: HTMLDivElement
  sizeOptionDom: HTMLDivElement
  sizeSelectDom: HTMLDivElement
  boldDom: HTMLDivElement
  italicDom: HTMLDivElement
  underlineDom: HTMLDivElement
  strikeoutDom: HTMLDivElement
  superscriptDom: HTMLDivElement
  subscriptDom: HTMLDivElement
  colorDom: HTMLDivElement
  colorControlDom: HTMLInputElement
  colorSpanDom: HTMLSpanElement
  highlightDom: HTMLDivElement
  highlightControlDom: HTMLInputElement
  highlightSpanDom: HTMLSpanElement
  titleOptionDom: HTMLDivElement
  titleSelectDom: HTMLDivElement
  leftDom: HTMLDivElement
  centerDom: HTMLDivElement
  rightDom: HTMLDivElement
  alignmentDom: HTMLDivElement
  justifyDom: HTMLDivElement
  rowOptionDom: HTMLDivElement
  listDom: HTMLDivElement
  listOptionDom: HTMLDivElement
  separatorDom: HTMLDivElement
  separatorOptionDom: HTMLDivElement
  commentDom: HTMLDivElement
  searchDom: HTMLDivElement
  searchInputDom: HTMLInputElement
  pageModeOptionsDom: HTMLDivElement
  setSearchResult: () => void
  updateCatalog: () => Promise<void>
  updateComment: () => Promise<void>
  isCatalogVisible: () => boolean
}