import MarkdownIt from 'markdown-it';
type Token = MarkdownIt.Token;

const ICONS: Record<string, string> = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  todo: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="m9 15 2 2 4-4"></path></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
  success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  danger: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
  failure: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  bug: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="14" x="8" y="6" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path><path d="m10 4 1 2"></path><path d="m14 4-1 2"></path></svg>',
  question: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  example: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>',
  quote: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>',
  abstract: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>'
};

// Aliases
ICONS['hint'] = ICONS['tip'];
ICONS['important'] = ICONS['tip'];
ICONS['check'] = ICONS['success'];
ICONS['done'] = ICONS['success'];
ICONS['caution'] = ICONS['warning'];
ICONS['attention'] = ICONS['warning'];
ICONS['error'] = ICONS['danger'];
ICONS['fail'] = ICONS['failure'];
ICONS['missing'] = ICONS['failure'];
ICONS['help'] = ICONS['question'];
ICONS['faq'] = ICONS['question'];
ICONS['cite'] = ICONS['quote'];
ICONS['summary'] = ICONS['abstract'];
ICONS['tldr'] = ICONS['abstract'];

export function calloutPlugin(md: MarkdownIt): void {
  md.core.ruler.after('block', 'callout', (state) => {
    const tokens = state.tokens;
    
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'blockquote_open') {
        let endIndex = -1;
        let nestedLevel = 0;
        
        for (let j = i + 1; j < tokens.length; j++) {
          if (tokens[j].type === 'blockquote_open') {
            nestedLevel++;
          } else if (tokens[j].type === 'blockquote_close') {
            if (nestedLevel === 0) {
              endIndex = j;
              break;
            } else {
              nestedLevel--;
            }
          }
        }
        
        if (endIndex === -1) { continue; }
        
        let firstInlineToken: Token | null = null;
        
        for (let j = i + 1; j < endIndex; j++) {
          if (tokens[j].type === 'paragraph_open') {
            if (tokens[j+1] && tokens[j+1].type === 'inline') {
              firstInlineToken = tokens[j+1];
            }
            break;
          }
        }
        
        if (!firstInlineToken) { continue; }
        
        // Match the callout syntax: [!type]+ Title
        const match = firstInlineToken.content.match(/^\[!([a-zA-Z]+)\]([+-]?)(?:\s+(.*))?/);
        if (!match) { continue; }
        
        const typeStr = match[1].toLowerCase();
        if (!Object.prototype.hasOwnProperty.call(ICONS, typeStr)) { continue; }
        
        const collapseModifier = match[2]; // "+" or "-" or ""
        let titleText = match[3] || typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
        titleText = md.utils.escapeHtml(titleText);
        
        // Strip the callout syntax from the inline token
        const stripLength = match[0].length;
        firstInlineToken.content = firstInlineToken.content.slice(stripLength);
        if (firstInlineToken.children && firstInlineToken.children.length > 0) {
          const firstChild = firstInlineToken.children[0];
          if (firstChild.type === 'text') {
            firstChild.content = firstChild.content.slice(stripLength);
          }
        }
        
        // Transform blockquote into callout div
        tokens[i].type = 'callout_open';
        tokens[i].tag = 'div';
        
        let classes = 'mv-callout';
        if (collapseModifier) {
          classes += ' is-collapsible';
          if (collapseModifier === '-') {
            classes += ' is-collapsed';
          }
        }
        
        tokens[i].attrSet('class', classes);
        tokens[i].attrSet('data-callout', typeStr);
        
        // Create title token
        const titleHtml = new state.Token('html_block', '', 0);
        titleHtml.content = `<div class="mv-callout-title">
  <span class="mv-callout-icon">${ICONS[typeStr] || ''}</span>
  <span class="mv-callout-title-text">${titleText}</span>
  ${collapseModifier ? '<span class="mv-callout-fold">▸</span>' : ''}
</div>\n<div class="mv-callout-content">`;

        tokens.splice(i + 1, 0, titleHtml);
        endIndex++; // We added a token, so endIndex shifts
        
        // Close the inner content div before the blockquote_close
        const contentCloseHtml = new state.Token('html_block', '', 0);
        contentCloseHtml.content = '</div>';
        
        tokens.splice(endIndex, 0, contentCloseHtml);
        endIndex++;
        
        tokens[endIndex].type = 'callout_close';
        tokens[endIndex].tag = 'div';
      }
    }
  });
}
