/**
 * UI Formatting Utilities
 * Helper functions to create perfectly aligned ASCII boxes for Telegram messages
 */

/**
 * Creates a formatted ASCII box with a header, content lines, and footer.
 * Automatically handles padding and border alignment.
 * 
 * @param title Header title (inside the box)
 * @param lines Array of content lines. Each line can be a string or an object { left: string, right: string } for split alignment.
 * @param width Total width of the box (default: 30) - Adjusted for mobile screens
 * @returns Formatted string
 */
export function createBox(title: string, lines: (string | { left: string, right: string } | null | undefined)[], width: number = 29): string {
  const BORDER_TOP = '┌' + '─'.repeat(width - 2) + '┐';
  const BORDER_BOTTOM = '└' + '─'.repeat(width - 2) + '┘';
  const SEPARATOR = '│' + ' ' + '━'.repeat(width - 4) + ' ' + '│'; // Using thicker line for separation
  const EMPTY_LINE = '│' + ' '.repeat(width - 2) + '│';
  
  let content = '';
  
  // Header
  // Ensure title fits or truncate
  const maxTitleLen = width - 4; // '│ ' + title + ' │'
  let safeTitle = title.length > maxTitleLen ? title.substring(0, maxTitleLen - 1) + '…' : title;
  content += `│ ${safeTitle.padEnd(maxTitleLen, ' ')} │\n`;
  content += EMPTY_LINE + '\n';
  
  // Content
  for (const line of lines) {
    if (line === null || line === undefined) continue; // Skip conditional lines that are falsy
    
    if (line === '---') {
        content += SEPARATOR + '\n';
        content += EMPTY_LINE + '\n';
        continue;
    }
    
    if (line === '') {
        content += EMPTY_LINE + '\n';
        continue;
    }

    if (typeof line === 'string') {
      // Single text line
      // Wrap text if too long
      const maxTextLen = width - 4;
      if (line.length > maxTextLen) {
        // Simple wrapping logic
         const words = line.split(' ');
         let currentLine = '';
         for (const word of words) {
            // Check if word itself is too long for a single line
            if (word.length > maxTextLen) {
                // If we have current buffer, flush it
                if (currentLine.length > 0) {
                     content += `│ ${currentLine.trim().padEnd(maxTextLen, ' ')} │\n`;
                     currentLine = '';
                }
                // Split long word into chunks
                let remaining = word;
                while (remaining.length > 0) {
                    if (remaining.length > maxTextLen) {
                        content += `│ ${remaining.slice(0, maxTextLen)} │\n`;
                        remaining = remaining.slice(maxTextLen);
                    } else {
                        currentLine = remaining + ' ';
                        remaining = '';
                    }
                }
            } else if ((currentLine + word).length + 1 > maxTextLen) {
                content += `│ ${currentLine.trim().padEnd(maxTextLen, ' ')} │\n`;
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
         }
         if (currentLine.trim().length > 0) {
            content += `│ ${currentLine.trim().padEnd(maxTextLen, ' ')} │\n`;
         }
      } else {
        content += `│ ${line.padEnd(maxTextLen, ' ')} │\n`;
      }
    } else {
      // Left/Right split (e.g., { left: "Balance:", right: "$100.00" })
      const left = line.left;
      const right = line.right;
      const maxLen = width - 4;
      
      const combinedLen = left.length + right.length + 1; // +1 for at least one space
      
      if (combinedLen > maxLen) {
          // If too long, put on separate lines or truncate
          content += `│ ${left.padEnd(maxLen, ' ')} │\n`;
          content += `│ ${right.padStart(maxLen, ' ')} │\n`;
      } else {
          // Key.............Value
          // Or Key          Value
          const spacing = maxLen - left.length - right.length;
          content += `│ ${left}${(' ').repeat(spacing)}${right} │\n`;
      }
    }
  }

  return BORDER_TOP + '\n' + content + BORDER_BOTTOM;
}
