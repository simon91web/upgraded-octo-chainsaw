// Nachbau der Kopf-Helfer aus Yuvomis /utils/page-layout.js (gleiche Klassen, damit layout.css greift).
export const renderPageHeader = ({ title = '', actions = '' } = {}) => `<div class="page-toolbar page-toolbar--narrow">\n${title}\n${actions}\n</div>`;
export const renderPageTitle = (text) => `<h1 class="page-toolbar__title">${text}</h1>`;
export const renderPageActions = (inhalt) => `<div class="page-toolbar__actions">\n${inhalt}\n</div>`;
