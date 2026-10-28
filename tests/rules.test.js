const assert = require('node:assert/strict');
const test = require('node:test');
const { runInNewContext } = require('node:vm');
const { ESLint } = require('eslint');
const prettier = require('prettier');
const stylelint = require('stylelint');

const config = { overrideConfigFile: 'eslint.config.js' };
const lint = new ESLint(config);
const fix = new ESLint({ ...config, fix: true });

const assertRules = (result, rules) => {
    for (const rule of rules) {
        assert.ok(
            result.messages.some(message => message.ruleId === rule),
            rule
        );
    }
    assert.ok(result.messages.every(message => message.severity === 2));
};

test('JS formatting, ordering and callbacks are errors and fix cleanly', async () => {
    const code =
        'var obj={z:1,a:2};\n\tconsole.log([obj].map(function named(value){return value;}))\n';
    const [before] = await lint.lintText(code, { filePath: 'fixture.js' });
    assertRules(before, [
        'no-var',
        'prettier/prettier',
        'perfectionist/sort-objects',
        'prefer-arrow-callback',
        'no-restricted-syntax'
    ]);
    const [after] = await fix.lintText(code, { filePath: 'fixture.js' });
    assert.equal(after.errorCount, 0);
    assert.match(after.output, /const obj = \{ a: 2, z: 1 \};/);
    assert.match(after.output, /value =>/);
    const [again] = await fix.lintText(after.output, {
        filePath: 'fixture.js'
    });
    assert.equal(again.output, undefined);
});

test('unused variables, arguments and catch bindings are errors in JS and TS', async () => {
    for (const filePath of ['fixture.js', 'fixture.ts']) {
        const unusedRule = filePath.endsWith('.ts')
            ? '@typescript-eslint/no-unused-vars'
            : 'no-unused-vars';
        const [result] = await lint.lintText(
            'let unused = 1;\nexport function f(arg) { try {} catch (err) {} }\n',
            { filePath }
        );
        assertRules(result, ['prefer-const', unusedRule]);
        assert.equal(
            result.messages.filter(message => message.ruleId === unusedRule)
                .length,
            3
        );
    }
});

test('recursive named callbacks remain prohibited when unsafe to fix', async () => {
    const [result] = await fix.lintText(
        'console.log([1].map(function named(n) { return n ? named(n - 1) : 0; }));',
        { filePath: 'fixture.js' }
    );
    assertRules(result, ['no-restricted-syntax']);
});

test('JSON and JSONC keys sort recursively without sorting arrays', async () => {
    for (const filePath of ['fixture.json', 'fixture.jsonc']) {
        const code = '{"z":[2,1],"a":{"z":1,"a":2}}';
        const [before] = await lint.lintText(code, { filePath });
        assertRules(before, ['jsonc/sort-keys', 'prettier/prettier']);
        const [after] = await fix.lintText(code, { filePath });
        assert.equal(after.errorCount, 0);
        const value = JSON.parse(after.output);
        assert.deepEqual(Object.keys(value), ['a', 'z']);
        assert.deepEqual(Object.keys(value.a), ['a', 'z']);
        assert.deepEqual(value.z, [2, 1]);
    }
});

test('CSS, SCSS and Less sort declarations and shorten hex colors', async () => {
    for (const extension of ['css', 'scss', 'less']) {
        const options = {
            code: '.a {\n\tz-index: 1;\n color: #aabbcc;\n}\n',
            codeFilename: `fixture.${extension}`,
            configFile: 'stylelint.config.js'
        };
        const before = await stylelint.lint(options);
        for (const rule of [
            'order/properties-alphabetical-order',
            'color-hex-length',
            'prettier/prettier'
        ]) {
            assert.ok(
                before.results[0].warnings.some(
                    warning => warning.rule === rule
                ),
                rule
            );
        }
        assert.ok(
            before.results[0].warnings.every(
                warning => warning.severity === 'error'
            )
        );
        const after = await stylelint.lint({ ...options, fix: true });
        assert.equal(after.errored, false);
        assert.match(after.code, /color: #abc;\n {4}z-index: 1;/);
        const again = await stylelint.lint({ ...options, code: after.code });
        assert.equal(again.errored, false);
    }
});

test('Vue template references count as used', async () => {
    const [result] = await fix.lintText(
        '<script setup lang="ts">\nconst message = "hello";\n</script>\n<template><p>{{ message }}</p></template>\n',
        { filePath: 'TestFixture.vue' }
    );
    assert.equal(result.errorCount, 0);
});

test('Prettier alone enforces quotes, semicolons, spacing and optional property quotes', async () => {
    const [result] = await fix.lintText(
        'export const item={"name":"hello"}\nexport const fn=(value)=>value\nexport const view=<p title=\'hello\'/>\n',
        { filePath: 'fixture.jsx' }
    );
    assert.equal(result.errorCount, 0);
    assert.match(result.output, /item = \{ name: 'hello' \};/);
    assert.match(result.output, /fn = value => value;/);
    assert.match(result.output, /title="hello"/);
});

test('Tab indentation is fixed without rejecting tabs in string content', async () => {
    const [result] = await fix.lintText(
        'export function message() {\n\treturn `left\tright`;\n}\n',
        { filePath: 'fixture.js' }
    );
    assert.equal(result.errorCount, 0);
    assert.match(result.output, /\n {4}return/);
    assert.ok(result.output.includes('left\tright'));
});

test('JSON syntax stays strict while JSONC accepts comments', async () => {
    const code = '{\n// comment\n"name": "hello"\n}';
    const [json] = await lint.lintText(code, { filePath: 'fixture.json' });
    assert.ok(json.errorCount > 0);
    const [jsonc] = await fix.lintText(code, { filePath: 'fixture.jsonc' });
    assert.equal(jsonc.errorCount, 0);
});

test('recommended rules remain active beyond personal preferences', async () => {
    const cases = [
        ['fixture.js', 'missingFunction();', 'no-undef'],
        [
            'fixture.ts',
            'export const value: any = 1;',
            '@typescript-eslint/no-explicit-any'
        ],
        [
            'TestFixture.vue',
            '<template><div v-for="item in [1]">{{ item }}</div></template>',
            'vue/require-v-for-key'
        ],
        ['fixture.json', '{"name":1,"name":2}', 'jsonc/no-dupe-keys']
    ];
    for (const [filePath, code, rule] of cases) {
        const [result] = await lint.lintText(code, { filePath });
        assert.ok(
            result.messages.some(message => message.ruleId === rule),
            rule
        );
    }
    const css = await stylelint.lint({
        code: '.a { imaginary-property: 1; }',
        codeFilename: 'fixture.css',
        configFile: 'stylelint.config.js'
    });
    assert.ok(
        css.results[0].warnings.some(
            warning => warning.rule === 'property-no-unknown'
        )
    );
});

test('resolved configs preserve preferences and disable competing format rules', async () => {
    for (const filePath of ['fixture.js', 'fixture.ts', 'TestFixture.vue']) {
        const config = await lint.calculateConfigForFile(filePath);
        assert.equal(config.rules['prettier/prettier'][0], 2);
        assert.equal(config.rules['no-var'][0], 2);
        assert.equal(config.rules['prefer-const'][0], 2);
        const ts = !filePath.endsWith('.js');
        assert.equal(config.rules['no-unused-vars'][0], ts ? 0 : 2);
        if (ts)
            assert.equal(
                config.rules['@typescript-eslint/no-unused-vars'][0],
                2
            );
        assert.equal(config.rules['vue/html-indent'][0], 0);
    }
    const json = await lint.calculateConfigForFile('fixture.json');
    assert.equal(json.rules['jsonc/quotes'][0], 0);
    assert.equal(json.rules['jsonc/indent'][0], 0);
    assert.equal(json.rules['jsonc/sort-keys'][0], 2);
    for (const extension of ['css', 'scss', 'less']) {
        const config = await stylelint.resolveConfig(`fixture.${extension}`, {
            configFile: 'stylelint.config.js'
        });
        assert.equal(config.rules['color-hex-length'][0], 'short');
        assert.equal(
            config.rules['order/properties-alphabetical-order'][0],
            true
        );
    }
});

test('multiline arrays, objects and imports have no trailing commas and fix stably', async () => {
    const name = 'aLongNameThatMakesTheStatementExceedTheDefaultPrintWidth';
    const code = `import { ${name}, anotherLongImportedName, } from 'example';\nexport { ${name}, anotherLongImportedName, };\nexport const values = [${name}, anotherLongImportedName, '${'x'.repeat(65)}',];\nexport const object = {z: values, a: '${'x'.repeat(65)}',};\n`;
    const [result] = await fix.lintText(code, { filePath: 'fixture.mjs' });
    assert.equal(result.errorCount, 0);
    assert.doesNotMatch(result.output, /,\s*[}\]]/);
    assert.match(result.output, /\n {4}/);
    const [again] = await fix.lintText(result.output, {
        filePath: 'fixture.mjs'
    });
    assert.equal(again.output, undefined);
    assert.equal(again.errorCount, 0);
});

test('HTML and Pug use their configured attribute quotes', async () => {
    const cases = [
        [
            'fixture.html',
            "<div title='Hello'>Text</div>",
            '<div title="Hello">Text</div>\n'
        ],
        [
            'fixture.pug',
            'a(href="/about", title="Hello") Text',
            "a(href='/about', title='Hello') Text\n"
        ]
    ];
    for (const [filepath, code, expected] of cases) {
        const options = {
            ...(await prettier.resolveConfig(filepath)),
            filepath
        };
        const output = await prettier.format(code, options);
        assert.equal(output, expected);
        assert.equal(await prettier.format(output, options), output);
    }
});

test('YAML keeps necessary quotes and preserves plain values', async () => {
    for (const filepath of ['fixture.yaml', 'fixture.yml']) {
        const options = {
            ...(await prettier.resolveConfig(filepath)),
            filepath
        };
        const code =
            'name: Alice\nversion: "1.0"\nmessage: "Hello: YAML"\nflag: "true"\n';
        const output = await prettier.format(code, options);
        assert.equal(
            output,
            "name: Alice\nversion: '1.0'\nmessage: 'Hello: YAML'\nflag: 'true'\n"
        );
        assert.equal(await prettier.format(output, options), output);
    }
});

test('CSS, SCSS and Less enforce double quotes and retain escape optimization', async () => {
    for (const extension of ['css', 'scss', 'less']) {
        const options = {
            codeFilename: `fixture.${extension}`,
            configFile: 'stylelint.config.js'
        };
        const code = ".a {\n    content: 'Hello';\n}\n";
        const before = await stylelint.lint({ ...options, code });
        assert.ok(
            before.results[0].warnings.some(
                warning =>
                    warning.rule === 'prettier/prettier' &&
                    warning.severity === 'error'
            )
        );
        const fixed = await stylelint.lint({ ...options, code, fix: true });
        assert.equal(fixed.errored, false);
        assert.equal(fixed.code, '.a {\n    content: "Hello";\n}\n');
        const escaped = '.a {\n    content: \'Say "hello"\';\n}\n';
        const preserved = await stylelint.lint({
            ...options,
            code: escaped,
            fix: true
        });
        assert.equal(preserved.errored, false);
        assert.equal(preserved.code, escaped);
        const again = await stylelint.lint({ ...options, code: fixed.code });
        assert.equal(again.errored, false);
    }
});

test('object sorting preserves spread and computed-key overwrite semantics', async () => {
    const cases = [
        [
            'const base = { a: 5 }; module.exports = { z: 0, a: 1, ...base, y: 2, b: 3 };',
            '{ a: 1, z: 0, ...base, b: 3, y: 2 }'
        ],
        [
            "const key = 'a'; module.exports = { z: 0, [key]: 1, b: 2, a: 3 };",
            '{ z: 0, [key]: 1, a: 3, b: 2 }'
        ]
    ];
    const evaluate = code => {
        const context = { module: { exports: {} } };
        runInNewContext(code, context, { timeout: 1000 });
        return Object.fromEntries(
            Object.entries(context.module.exports).sort()
        );
    };
    for (const [code, expected] of cases) {
        const [before] = await lint.lintText(code, { filePath: 'fixture.cjs' });
        assertRules(before, ['perfectionist/sort-objects']);
        const [after] = await fix.lintText(code, { filePath: 'fixture.cjs' });
        assert.equal(after.errorCount, 0);
        assert.ok(after.output.includes(expected));
        assert.deepEqual(evaluate(after.output), evaluate(code));
        const [again] = await fix.lintText(after.output, {
            filePath: 'fixture.cjs'
        });
        assert.equal(again.output, undefined);
    }
});

test('JS and JSONC sorting keeps leading and trailing comments with their keys', async () => {
    const cases = [
        [
            'fixture.cjs',
            'module.exports = {\n// Z value\nz: 1, // Z note\n// A value\na: 2 // A note\n};',
            'perfectionist/sort-objects'
        ],
        [
            'fixture.jsonc',
            '{\n// Z value\n"z": 1, // Z note\n// A value\n"a": 2 // A note\n}',
            'jsonc/sort-keys'
        ]
    ];
    for (const [filePath, code, rule] of cases) {
        const [before] = await lint.lintText(code, { filePath });
        assertRules(before, [rule]);
        const [after] = await fix.lintText(code, { filePath });
        assert.equal(after.errorCount, 0);
        assert.match(after.output, /\/\/ A value\n\s*"?a"?: 2,? \/\/ A note/);
        assert.match(after.output, /\/\/ Z value\n\s*"?z"?: 1,? \/\/ Z note/);
        assert.ok(
            after.output.indexOf('// A value') <
                after.output.indexOf('// Z value')
        );
        const [again] = await fix.lintText(after.output, { filePath });
        assert.equal(again.output, undefined);
    }
});

test('style sorting preserves comments attached to declarations', async () => {
    for (const extension of ['css', 'scss', 'less']) {
        const options = {
            code: '.a {\n    /* Stack order */\n    z-index: 1;\n    /* Text color */\n    color: #abc;\n}\n',
            codeFilename: `fixture.${extension}`,
            configFile: 'stylelint.config.js'
        };
        const result = await stylelint.lint({ ...options, fix: true });
        assert.equal(result.errored, false);
        assert.match(result.code, /\/\* Text color \*\/\n\s*color: #abc;/);
        assert.match(result.code, /\/\* Stack order \*\/\n\s*z-index: 1;/);
        assert.ok(
            result.code.indexOf('color:') < result.code.indexOf('z-index:')
        );
        const again = await stylelint.lint({
            ...options,
            code: result.code,
            fix: true
        });
        assert.equal(again.code, result.code);
        assert.equal(again.errored, false);
    }
});
