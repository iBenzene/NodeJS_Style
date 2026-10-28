module.exports = {
    extends: ['stylelint-config-standard'],
    overrides: [
        { extends: ['stylelint-config-standard-scss'], files: ['**/*.scss'] },
        { extends: ['stylelint-config-standard-less'], files: ['**/*.less'] }
    ],
    plugins: ['stylelint-order', 'stylelint-prettier'],
    rules: {
        'order/properties-alphabetical-order': true,
        'prettier/prettier': true
    }
};
