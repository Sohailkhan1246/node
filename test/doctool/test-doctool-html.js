'use strict';

const common = require('../common');
// The doctool currently uses js-yaml from the tool/node_modules/eslint/ tree.
try {
  require('../../tools/node_modules/eslint/node_modules/js-yaml');
} catch {
  common.skip('missing js-yaml (eslint not present)');
}

const assert = require('assert');
const { readFile } = require('fs');
const fixtures = require('../common/fixtures');
const { replaceLinks } = require('../../tools/doc/markdown.js');
const html = require('../../tools/doc/html.js');
const path = require('path');

module.paths.unshift(
  path.join(__dirname, '..', '..', 'tools', 'doc', 'node_modules'));
const unified = require('unified');
const markdown = require('remark-parse');
const remark2rehype = require('remark-rehype');
const raw = require('rehype-raw');
const htmlStringify = require('rehype-stringify');

// Test links mapper is an object of the following structure:
// {
//   [filename]: {
//     [link definition identifier]: [url to the linked resource]
//   }
// }
const testLinksMapper = {
  'foo': {
    'command line options': 'cli.html#cli-options',
    'web server': 'example.html'
  }
};

function toHTML({ input, filename, nodeVersion, versions }) {
  const content = unified()
    .use(replaceLinks, { filename, linksMapper: testLinksMapper })
    .use(markdown)
    .use(html.firstHeader)
    .use(html.preprocessText, { nodeVersion })
    .use(html.preprocessElements, { filename })
    .use(html.buildToc, { filename, apilinks: {} })
    .use(remark2rehype, { allowDangerousHTML: true })
    .use(raw)
    .use(htmlStringify)
    .processSync(input);

  return html.toHTML({ input, content, filename, nodeVersion, versions });
}

// Test data is a list of objects with two properties.
// The file property is the file path.
// The html property is some HTML which will be generated by the doctool.
// This HTML will be stripped of all whitespace because we don't currently
// have an HTML parser.
const testData = [
  {
    file: fixtures.path('sample_document.md'),
    html: '<ol><li>fish</li><li>fish</li></ol>' +
      '<ul><li>Redfish</li><li>Bluefish</li></ul>'
  },
  {
    file: fixtures.path('order_of_end_tags_5873.md'),
    html: '<h3>Static method: Buffer.from(array) <span> ' +
      '<a class="mark" href="#foo_static_method_buffer_from_array" ' +
      'id="foo_static_method_buffer_from_array">#</a> </span> </h3>' +
      '<ul><li><code>array</code><a ' +
      'href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/' +
      'Reference/Global_Objects/Array" class="type">&#x3C;Array></a></li></ul>'
  },
  {
    file: fixtures.path('doc_with_yaml.md'),
    html: '<h1>Sample Markdown with YAML info' +
      '<span><a class="mark" href="#foo_sample_markdown_with_yaml_info" ' +
      ' id="foo_sample_markdown_with_yaml_info">#</a></span></h1>' +
      '<h2>Foobar<span><a class="mark" href="#foo_foobar" ' +
      'id="foo_foobar">#</a></span></h2>' +
      '<div class="api_metadata"><span>Added in: v1.0.0</span></div> ' +
      '<p>Describe <code>Foobar</code> in more detail here.</p>' +
      '<h2>Foobar II<span><a class="mark" href="#foo_foobar_ii" ' +
      'id="foo_foobar_ii">#</a></span></h2><div class="api_metadata">' +
      '<details class="changelog"><summary>History</summary>' +
      '<table><tbody><tr><th>Version</th><th>Changes</th></tr>' +
      '<tr><td>v5.3.0, v4.2.0</td>' +
      '<td><p><span>Added in: v5.3.0, v4.2.0</span></p></td></tr>' +
      '<tr><td>v4.2.0</td><td><p>The <code>error</code> parameter can now be' +
      'an arrow function.</p></td></tr></tbody></table></details></div> ' +
      '<p>Describe <code>Foobar II</code> in more detail here.' +
      '<a href="http://man7.org/linux/man-pages/man1/fg.1.html"><code>fg(1)' +
      '</code></a></p><h2>Deprecated thingy<span><a class="mark" ' +
      'href="#foo_deprecated_thingy" id="foo_deprecated_thingy">#</a>' +
      '</span></h2><div class="api_metadata"><span>Added in: v1.0.0</span>' +
      '<span>Deprecated since: v2.0.0</span></div><p>Describe ' +
      '<code>Deprecated thingy</code> in more detail here.' +
      '<a href="http://man7.org/linux/man-pages/man1/fg.1p.html"><code>fg(1p)' +
      '</code></a></p><h2>Something<span><a class="mark" href="#foo_something' +
      '" id="foo_something">#</a></span></h2> ' +
      '<!-- This is not a metadata comment --> ' +
      '<p>Describe <code>Something</code> in more detail here. </p>'
  },
  {
    file: fixtures.path('sample_document.md'),
    html: '<ol><li>fish</li><li>fish</li></ol>' +
      '<ul><li>Red fish</li><li>Blue fish</li></ul>',
  },
  {
    file: fixtures.path('altdocs.md'),
    html: '<li><a href="https://nodejs.org/docs/latest-v8.x/api/foo.html">8.x',
  },
  {
    file: fixtures.path('document_with_links.md'),
    html: '<h1>Usage and Example<span><a class="mark"' +
    'href="#foo_usage_and_example" id="foo_usage_and_example">#</a>' +
    '</span></h1><h2>Usage<span><a class="mark" href="#foo_usage"' +
    'id="foo_usage">#</a></span></h2><p><code>node \\[options\\] index.js' +
    '</code></p><p>Please see the<a href="cli.html#cli-options">' +
    'Command Line Options</a>document for more information.</p><h2>' +
    'Example<span><a class="mark" href="#foo_example" id="foo_example">' +
    '#</a></span></h2><p>An example of a<a href="example.html">' +
    'webserver</a>written with Node.js which responds with<code>' +
    '\'Hello, World!\'</code>:</p><h2>See also<span><a class="mark"' +
    'href="#foo_see_also" id="foo_see_also">#</a></span></h2><p>Check' +
    'out also<a href="https://nodejs.org/">this guide</a></p>'
  },
];

const spaces = /\s/g;
const versions = [
  { num: '10.x', lts: true },
  { num: '9.x' },
  { num: '8.x' },
  { num: '7.x' },
  { num: '6.x' },
  { num: '5.x' },
  { num: '4.x' },
  { num: '0.12.x' },
  { num: '0.10.x' }];

testData.forEach(({ file, html }) => {
  // Normalize expected data by stripping whitespace.
  const expected = html.replace(spaces, '');

  readFile(file, 'utf8', common.mustCall(async (err, input) => {
    assert.ifError(err);
    const output = toHTML({ input: input,
                            filename: 'foo',
                            nodeVersion: process.version,
                            versions: versions });

    const actual = output.replace(spaces, '');
    // Assert that the input stripped of all whitespace contains the
    // expected markup.
    assert(actual.includes(expected),
           `ACTUAL: ${actual}\nEXPECTED: ${expected}`);
  }));
});
