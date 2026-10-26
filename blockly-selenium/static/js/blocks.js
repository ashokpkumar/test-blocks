// Every block the editor knows about. `parts` mixes label text with fields;
// field names must match what runner.py reads from block["fields"].
// Default values point at the built-in playground so every block works
// the moment it's dropped in.

export const CATEGORIES = [
  { id: 'start',   name: 'Start',   icon: '🚀', color: '#FFB703', dark: '#D99A00', text: '#4A3200' },
  { id: 'browser', name: 'Browser', icon: '🌐', color: '#3A86FF', dark: '#2366D1' },
  { id: 'actions', name: 'Actions', icon: '👆', color: '#FF4FA3', dark: '#D93485' },
  { id: 'wait',    name: 'Wait',    icon: '⏳', color: '#00BFA6', dark: '#009683' },
  { id: 'check',   name: 'Check',   icon: '✅', color: '#3DBE52', dark: '#2A9A3D' },
  { id: 'vars',    name: 'Variables', icon: '📦', color: '#FF6B2C', dark: '#DB4E12' },
  { id: 'scrape',  name: 'Scrape',  icon: '🕸️', color: '#F2668B', dark: '#D1456C' },
  { id: 'files',   name: 'Files',   icon: '💾', color: '#5B6CF0', dark: '#3F4FD1' },
  { id: 'popups',  name: 'Popups',  icon: '🪟', color: '#8B5CF6', dark: '#6D3FDB' },
  { id: 'control', name: 'Control', icon: '🔁', color: '#FFAB19', dark: '#DB8C00', text: '#4A3200' },
];

const LOCATORS = [
  ['css', 'css'], ['xpath', 'xpath'], ['id', 'id'], ['name', 'name'],
  ['link text', 'link'], ['part of link', 'partial'], ['class', 'class'], ['tag', 'tag'],
];
const KEYS = [
  ['ENTER ⏎', 'enter'], ['TAB ⇥', 'tab'], ['ESC', 'escape'], ['SPACE', 'space'],
  ['BACKSPACE ⌫', 'backspace'], ['DELETE', 'delete'], ['↑', 'up'], ['↓', 'down'],
  ['←', 'left'], ['→', 'right'], ['HOME', 'home'], ['END', 'end'],
  ['PAGE UP', 'pageup'], ['PAGE DOWN', 'pagedown'],
];

const text = (name, value = '') => ({ kind: 'text', name, value });
const num = (name, value = 1) => ({ kind: 'number', name, value: String(value) });
const pick = (name, options, value) => ({ kind: 'select', name, options, value: value ?? options[0][1] });
// A variable picker: a dropdown of the workspace's variables (plus "new variable…").
const v = (name, value) => ({ kind: 'var', name, value });
// A file picker: the chosen file is read in the browser and travels with the block.
const file = name => ({ kind: 'file', name, value: null });
const COMPARE = [['=', '='], ['≠', '!='], ['>', '>'], ['<', '<'], ['contains', 'contains']];
const el = (value, prefix = '') => [pick(prefix + 'by', LOCATORS, 'css'), text(prefix + 'target', value)];

const PLAYGROUND = 'http://localhost:8000/playground';

const LIST = [
  // ---- Start ----
  { type: 'start', cat: 'start', shape: 'hat', parts: ['when ▶ Run is clicked'],
    tip: 'Every test starts here. Snap blocks underneath!' },

  // ---- Browser ----
  { type: 'open_browser', cat: 'browser', parts: ['open', pick('browser', [['Chrome', 'chrome'], ['Edge', 'edge'], ['Firefox', 'firefox']]), 'browser', pick('mode', [['👀 so I can watch', 'visible'], ['🙈 hidden', 'hidden']])],
    tip: 'Starts a real web browser' },
  { type: 'go_to', cat: 'browser', parts: ['go to', text('url', PLAYGROUND)], tip: 'Opens a web page' },
  { type: 'back', cat: 'browser', parts: ['go back ⬅️'], tip: 'Like the browser back button' },
  { type: 'forward', cat: 'browser', parts: ['go forward ➡️'], tip: 'Like the browser forward button' },
  { type: 'refresh', cat: 'browser', parts: ['refresh the page 🔄'], tip: 'Reloads the page' },
  { type: 'maximize', cat: 'browser', parts: ['make the window big ⛶'], tip: 'Maximizes the window' },
  { type: 'window_size', cat: 'browser', parts: ['set window size', num('width', 1280), '×', num('height', 800)], tip: 'Resizes the window in pixels' },
  { type: 'new_tab', cat: 'browser', parts: ['open a new tab at', text('url', 'example.com')], tip: 'Opens and switches to a new tab' },
  { type: 'switch_tab', cat: 'browser', parts: ['switch to tab #', num('index', 1)], tip: 'Tab #1 is the first tab' },
  { type: 'close_tab', cat: 'browser', parts: ['close this tab'], tip: 'Closes the current tab' },
  { type: 'screenshot', cat: 'browser', parts: ['take a picture 📸 named', text('name', 'my-page')], tip: 'Saves a screenshot — it shows up in the diary' },
  { type: 'delete_cookies', cat: 'browser', parts: ['delete all cookies 🍪'], tip: 'Forgets logins and saved site data' },
  { type: 'close_browser', cat: 'browser', parts: ['close the browser 👋'], tip: 'Closes the browser completely' },

  // ---- Actions ----
  { type: 'click', cat: 'actions', parts: ['click', ...el('#hello-btn')], tip: 'Clicks a button, link or anything else' },
  { type: 'double_click', cat: 'actions', parts: ['double-click', ...el('#double-box')], tip: 'Clicks twice, fast' },
  { type: 'right_click', cat: 'actions', parts: ['right-click', ...el('#right-box')], tip: 'Opens the right-click menu' },
  { type: 'hover', cat: 'actions', parts: ['hover over', ...el('#hover-box')], tip: 'Moves the mouse on top of something' },
  { type: 'type_text', cat: 'actions', parts: ['type', text('text', 'Ada'), 'into', ...el('#name')], tip: 'Types letters into a text box' },
  { type: 'clear_field', cat: 'actions', parts: ['clear', ...el('#name')], tip: 'Empties a text box' },
  { type: 'press_key', cat: 'actions', parts: ['press', pick('key', KEYS), 'on', ...el('#name')], tip: 'Presses a keyboard key (leave the box empty to press it on the page)' },
  { type: 'select_text', cat: 'actions', parts: ['choose', text('option', 'Dragon'), 'from dropdown', ...el('#pet')], tip: 'Picks a dropdown option by the words you see' },
  { type: 'select_value', cat: 'actions', parts: ['choose value', text('value', 'dog'), 'from dropdown', ...el('#pet')], tip: 'Picks a dropdown option by its hidden value' },
  { type: 'set_checkbox', cat: 'actions', parts: [pick('state', [['tick ☑', 'on'], ['untick ☐', 'off']]), 'checkbox', ...el('#pizza')], tip: 'Ticks or unticks a checkbox' },
  { type: 'drag_drop', cat: 'actions', parts: ['drag', ...el('#star'), 'onto', ...el('#basket', 'to_')], tip: 'Drags one thing and drops it on another' },
  { type: 'scroll_to', cat: 'actions', parts: ['scroll to', ...el('#scores')], tip: 'Scrolls until the element is on screen' },
  { type: 'scroll_by', cat: 'actions', parts: ['scroll down by', num('pixels', 400), 'pixels'], tip: 'Use a minus number to scroll up' },
  { type: 'upload_file', cat: 'actions', parts: ['upload file', text('path', 'C:\\Users\\me\\picture.png'), 'into', ...el('#file')], tip: 'Picks a file from this computer' },
  { type: 'submit_form', cat: 'actions', parts: ['submit form', ...el('#signup')], tip: 'Sends a form, like pressing its Submit button' },
  { type: 'run_js', cat: 'actions', parts: ['run JavaScript', text('code', 'return document.title')], tip: 'For grown-ups: runs code inside the page' },

  // ---- Wait ----
  { type: 'wait_seconds', cat: 'wait', parts: ['wait', num('seconds', 1), 'seconds'], tip: 'Takes a little break' },
  { type: 'wait_visible', cat: 'wait', parts: ['wait until', ...el('#secret'), 'shows up · max', num('seconds', 10), 's'], tip: 'Waits for something to appear' },
  { type: 'wait_clickable', cat: 'wait', parts: ['wait until', ...el('#hello-btn'), 'can be clicked · max', num('seconds', 10), 's'], tip: 'Waits until a button is ready' },
  { type: 'wait_gone', cat: 'wait', parts: ['wait until', ...el('#loading'), 'disappears · max', num('seconds', 10), 's'], tip: 'Waits for something to go away' },
  { type: 'wait_title', cat: 'wait', parts: ['wait until the title has', text('text', 'Playground')], tip: 'Waits for the tab title to change' },
  { type: 'wait_text', cat: 'wait', parts: ['wait until', ...el('#greeting'), 'says', text('text', 'Hello')], tip: 'Waits for some words to appear' },

  // ---- Check ----
  { type: 'check_title', cat: 'check', parts: ['check the title', pick('mode', [['is', 'is'], ['contains', 'contains'], ['is not', 'not']], 'contains'), text('text', 'Playground')], tip: 'Checks the words on the browser tab' },
  { type: 'check_url', cat: 'check', parts: ['check the web address', pick('mode', [['contains', 'contains'], ['is', 'is'], ['is not', 'not']]), text('text', 'playground')], tip: 'Checks the address bar' },
  { type: 'check_text', cat: 'check', parts: ['check text of', ...el('#greeting'), pick('mode', [['is', 'is'], ['contains', 'contains'], ['is not', 'not']], 'contains'), text('text', 'Ada')], tip: 'Checks what something says' },
  { type: 'check_visible', cat: 'check', parts: ['check', ...el('#greeting'), 'is visible 👀'], tip: 'Checks you can see it' },
  { type: 'check_hidden', cat: 'check', parts: ['check', ...el('#secret'), 'is hidden 🙈'], tip: 'Checks you can NOT see it' },
  { type: 'check_enabled', cat: 'check', parts: ['check', ...el('#hello-btn'), 'is enabled'], tip: 'Checks it is not greyed out' },
  { type: 'check_selected', cat: 'check', parts: ['check', ...el('#pizza'), 'is ticked ☑'], tip: 'Checks a checkbox or option is chosen' },
  { type: 'check_attribute', cat: 'check', parts: ['check', ...el('#name'), 'has', text('attr', 'placeholder'), '=', text('value', 'Your name')], tip: 'Checks a hidden HTML attribute' },
  { type: 'check_count', cat: 'check', parts: ['check there are', num('count', 3), 'of', ...el('#scores tbody tr')], tip: 'Counts how many match' },
  { type: 'check_value', cat: 'check', parts: ['check text box', ...el('#name'), 'holds', text('value', 'Ada')], tip: 'Checks what is typed inside a text box' },

  // ---- Variables ----
  // Make a variable with the ➕ button, then drag its chip into any white box (e.g. say).
  { type: 'set_var', cat: 'vars', parts: ['set', v('name', 'my_variable'), 'to', text('value', '0')], tip: 'Puts a value in a variable' },
  { type: 'change_var', cat: 'vars', parts: ['change', v('name', 'my_variable'), 'by', num('by', 1)], tip: 'Adds to a number variable (use -1 to count down)' },
  { type: 'math_var', cat: 'vars', parts: ['set', v('name', 'my_variable'), 'to', text('a', '2'), pick('op', [['+', '+'], ['−', '-'], ['×', '*'], ['÷', '/'], ['remainder', '%']]), text('b', '3')], tip: 'Does maths and keeps the answer' },
  { type: 'join_var', cat: 'vars', parts: ['set', v('name', 'my_variable'), 'to', text('a', 'Hello '), 'joined with', text('b', 'world')], tip: 'Sticks two pieces of text together' },
  { type: 'random_var', cat: 'vars', parts: ['set', v('name', 'my_variable'), 'to a random number from', num('from', 1), 'to', num('to', 10)], tip: 'Picks a surprise number' },
  { type: 'date_var', cat: 'vars', parts: ['set', v('name', 'today'), 'to', pick('what', [["today's date", 'date'], ['the time now', 'time'], ['date and time', 'datetime'], ['a timestamp', 'stamp']])], tip: 'Remembers the date or time' },
  { type: 'list_add', cat: 'vars', parts: ['add', text('value', 'thing'), 'to list', v('name', 'my_list')], tip: 'Puts one more item at the end of a list' },
  { type: 'list_clear', cat: 'vars', parts: ['empty the list', v('name', 'my_list')], tip: 'Makes a list empty again' },
  { type: 'ask_var', cat: 'vars', parts: ['ask', text('question', "What's your name?"), 'and save the answer in', v('name', 'answer')], tip: 'Asks you a question while the test runs' },
  { type: 'check_scraped', cat: 'vars', parts: ['check variable', v('name', 'how_many'), pick('mode', [['is', 'is'], ['contains', 'contains'], ['is not', 'not'], ['is more than', 'more'], ['is less than', 'less']]), text('text', '4')], tip: 'Checks a variable. "more/less than" compares numbers, even in "$12.99"' },

  // ---- Scrape ----
  // Each one saves what it grabs in a variable.
  { type: 'scrape_text', cat: 'scrape', parts: ['grab text of', ...el('.product .name'), 'into', v('name', 'toy')], tip: 'Copies the words from one element into a variable' },
  { type: 'scrape_all', cat: 'scrape', parts: ['grab text of ALL', ...el('.product .price'), 'into', v('name', 'prices')], tip: 'Copies the words from every matching element into a list' },
  { type: 'scrape_attribute', cat: 'scrape', parts: ['grab', text('attr', 'href'), 'of', pick('which', [['first', 'first'], ['all', 'all']]), ...el('.product a'), 'into', v('name', 'links')], tip: 'Copies a hidden value like a link (href) or picture address (src)' },
  { type: 'scrape_table', cat: 'scrape', parts: ['grab table', ...el('#scores'), 'into', v('name', 'scores')], tip: 'Copies a whole table, rows and columns' },
  { type: 'scrape_links', cat: 'scrape', parts: ['grab every link on the page into', v('name', 'all_links')], tip: 'Collects the text and address of every link' },
  { type: 'scrape_page', cat: 'scrape', parts: ['grab the page', pick('what', [['title', 'title'], ['web address', 'url'], ['words (all text)', 'text']]), 'into', v('name', 'page')], tip: 'Copies the page title, address or all of its words' },
  { type: 'scrape_count', cat: 'scrape', parts: ['count', ...el('.product'), 'into', v('name', 'how_many')], tip: 'Counts how many elements match' },

  // ---- Files: inputs and outputs ----
  { type: 'load_file', cat: 'files', parts: ['load file', file('file'), 'into', v('name', 'data')], tip: 'Reads a CSV, Excel, JSON or text file from your computer into a variable' },
  { type: 'save_scraped', cat: 'files', parts: ['save', v('name', 'prices'), 'to file', text('file', 'toy-prices'), 'as', pick('format', [['Excel', 'xlsx'], ['CSV', 'csv'], ['JSON', 'json'], ['text', 'txt']])], tip: 'Saves a variable as a file' },
  { type: 'save_all', cat: 'files', parts: ['save ALL variables to file', text('file', 'results'), 'as', pick('format', [['Excel', 'xlsx'], ['JSON', 'json']])], tip: 'One file with every variable (Excel: one sheet per list or table)' },
  { type: 'download_image', cat: 'files', parts: ['download image', ...el('#robot-pic'), 'as', text('file', 'picture')], tip: 'Saves a picture from the page' },
  { type: 'download_link', cat: 'files', parts: ['download the file linked by', ...el('#price-list'), 'as', text('file', 'download')], tip: 'Saves the file a link points to' },
  { type: 'download_url', cat: 'files', parts: ['download', text('url', 'https://www.python.org/static/img/python-logo.png'), 'as', text('file', 'download')], tip: 'Saves any file from a web address' },
  { type: 'element_picture', cat: 'files', parts: ['take a picture of', ...el('#shop'), 'as', text('file', 'shop')], tip: 'A picture of just one part of the page' },
  { type: 'full_page_picture', cat: 'files', parts: ['take a full-page picture as', text('file', 'whole-page')], tip: 'A picture of the whole page, top to bottom' },
  { type: 'save_pdf', cat: 'files', parts: ['save the page as PDF', text('file', 'page')], tip: 'Prints the page into a PDF file' },
  { type: 'save_html', cat: 'files', parts: ['save the page code (HTML) as', text('file', 'page')], tip: "Saves the page's HTML source" },
  { type: 'output_folder', cat: 'files', parts: ['save files in folder', text('path', 'C:\\Users\\me\\Documents\\robot')], tip: 'On your own computer: where files go. On the website, files download instead' },

  // ---- Popups & frames ----
  { type: 'accept_alert', cat: 'popups', parts: ['click OK on the popup ✔'], tip: 'Says yes to an alert / confirm box' },
  { type: 'dismiss_alert', cat: 'popups', parts: ['click Cancel on the popup ✖'], tip: 'Says no to a confirm box' },
  { type: 'type_alert', cat: 'popups', parts: ['type', text('text', 'Robo'), 'into the popup and click OK'], tip: 'Answers a prompt box' },
  { type: 'check_alert', cat: 'popups', parts: ['check the popup says', text('text', 'Hello')], tip: 'Reads the popup without closing it' },
  { type: 'switch_frame', cat: 'popups', parts: ['go inside frame', ...el('#mini-frame')], tip: 'Steps into a page-inside-a-page (iframe)' },
  { type: 'switch_main', cat: 'popups', parts: ['go back to the main page'], tip: 'Steps out of all frames' },

  // ---- Control ----
  { type: 'repeat', cat: 'control', shape: 'c', parts: ['repeat', num('times', 3), 'times'], tip: 'Does the blocks inside again and again' },
  { type: 'if_exists', cat: 'control', shape: 'c', parts: ['if', ...el('#secret'), 'is on screen'], tip: 'Only does the inside blocks if it can see the element' },
  { type: 'if_compare', cat: 'control', shape: 'c', parts: ['if', text('a', '1'), pick('op', COMPARE), text('b', '1')], tip: 'Only does the inside blocks if this is true. Drop variables into the boxes' },
  { type: 'repeat_until', cat: 'control', shape: 'c', parts: ['repeat until', text('a', '1'), pick('op', COMPARE), text('b', '5')], tip: 'Keeps going until this becomes true' },
  { type: 'for_each', cat: 'control', shape: 'c', parts: ['for each item in', v('name', 'prices')], tip: 'Once per item: use the item and number variables. Tables also give one variable per column' },
  { type: 'say', cat: 'control', parts: ['say 💬', text('message', 'I did it!')], tip: 'Writes a message in the diary. Drop a variable in to say its value' },
];

export const BLOCKS = Object.fromEntries(LIST.map(d => [d.type, { shape: 'stack', ...d }]));
export const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fieldsOf = def => def.parts.filter(p => typeof p === 'object');

export function newBlock(type) {
  const def = BLOCKS[type];
  const b = { id: uid(), type, fields: Object.fromEntries(fieldsOf(def).map(f => [f.name, f.value])) };
  if (def.shape === 'c') b.children = [];
  return b;
}

// Deep copy with fresh ids (for duplicate).
export function cloneBlock(b) {
  const copy = { ...b, id: uid(), fields: { ...b.fields } };
  if (b.children) copy.children = b.children.map(cloneBlock);
  return copy;
}
