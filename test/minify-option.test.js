import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import postcss from 'postcss';

import CssMinimizerPlugin from '../src';

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAssets,
} from './helpers';

describe('"minify" option', () => {
  it('should work with "csso" minifier', async () => {
    const compiler = getCompiler({
      devtool: 'source-map',
      entry: {
        foo: `${__dirname}/fixtures/sourcemap/foo.scss`,
      },
      module: {
        rules: [
          {
            test: /.s?css$/i,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { sourceMap: true } },
              { loader: 'sass-loader', options: { sourceMap: true } },
            ],
          },
        ],
      },
    });

    new CssMinimizerPlugin({
      sourceMap: true,
      minify: async (data, inputMap) => {
        // eslint-disable-next-line global-require
        const csso = require('csso');
        // eslint-disable-next-line global-require
        const sourcemap = require('source-map');

        const [[filename, input]] = Object.entries(data);
        const minifiedCss = csso.minify(input, {
          filename,
          sourceMap: true,
        });

        if (inputMap) {
          minifiedCss.map.applySourceMap(
            new sourcemap.SourceMapConsumer(inputMap),
            filename
          );
        }

        return {
          css: minifiedCss.css,
          map: minifiedCss.map.toJSON(),
        };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readAssets(compiler, stats, /\.css(\.map)?$/)).toMatchSnapshot(
      'assets'
    );
    expect(getErrors(stats)).toMatchSnapshot('error');
    expect(getWarnings(stats)).toMatchSnapshot('warning');
  });

  it('should work with "clean-css" minifier', async () => {
    const compiler = getCompiler({
      devtool: 'source-map',
      entry: {
        foo: `${__dirname}/fixtures/foo.css`,
      },
    });

    new CssMinimizerPlugin({
      minify: async (data) => {
        // eslint-disable-next-line global-require
        const CleanCSS = require('clean-css');
        const [[filename, input]] = Object.entries(data);

        // Bug in `clean-css`
        // `clean-css` doesn't work with URLs in `sources`
        const minifiedCss = await new CleanCSS().minify({
          [filename]: {
            styles: input,
            // sourceMap: inputMap,
          },
        });

        return {
          css: minifiedCss.styles,
          // map: minifiedCss.sourceMap.toJSON(),
          warnings: minifiedCss.warnings,
        };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readAssets(compiler, stats, /\.css(\.map)?$/)).toMatchSnapshot(
      'assets'
    );
    expect(getErrors(stats)).toMatchSnapshot('error');
    expect(getWarnings(stats)).toMatchSnapshot('warning');
  });

  it('should work if minify is array', async () => {
    const compiler = getCompiler({
      devtool: 'source-map',
      entry: {
        foo: `${__dirname}/fixtures/sourcemap/foo.scss`,
      },
      module: {
        rules: [
          {
            test: /.s?css$/i,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { sourceMap: true } },
              { loader: 'sass-loader', options: { sourceMap: true } },
            ],
          },
        ],
      },
    });

    new CssMinimizerPlugin({
      sourceMap: true,
      minify: [
        async (data, inputMap) => {
          const [input] = Object.values(data);
          return {
            css: `${input}\n.one{color: red;}\n`,
            map: inputMap,
          };
        },
        async (data, inputMap) => {
          const [input] = Object.values(data);
          return {
            css: `${input}\n.two{color: red;}\n`,
            map: inputMap,
          };
        },
        async (data, inputMap) => {
          const [input] = Object.values(data);
          return {
            css: `${input}\n.three{color: red;}\n`,
            map: inputMap,
          };
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readAssets(compiler, stats, /\.css(\.map)?$/)).toMatchSnapshot(
      'assets'
    );
    expect(getErrors(stats)).toMatchSnapshot('error');
    expect(getWarnings(stats)).toMatchSnapshot('warning');
  });

  it('should work if minify is array and func return "undefined"', async () => {
    const compiler = getCompiler({
      devtool: 'source-map',
      entry: {
        foo: `${__dirname}/fixtures/sourcemap/foo.scss`,
      },
      module: {
        rules: [
          {
            test: /.s?css$/i,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { sourceMap: true } },
              { loader: 'sass-loader', options: { sourceMap: true } },
            ],
          },
        ],
      },
    });

    new CssMinimizerPlugin({
      sourceMap: true,
      minify: [
        async () => {},
        async (data, inputMap) => {
          const [input] = Object.values(data);
          return {
            css: `${input}\n.two{color: red;}\n`,
            map: inputMap,
          };
        },
        async () => {},
        async (data, inputMap) => {
          const [input] = Object.values(data);
          return {
            css: `${input}\n.three{color: red;}\n`,
            map: inputMap,
          };
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readAssets(compiler, stats, /\.css(\.map)?$/)).toMatchSnapshot(
      'assets'
    );
    expect(getErrors(stats)).toMatchSnapshot('error');
    expect(getWarnings(stats)).toMatchSnapshot('warning');
  });

  it('should work if minify is array and concat warnings', async () => {
    const plugin = postcss.plugin('warning-plugin', () => (css, result) => {
      result.warn(`Warning from ${result.opts.from}`, {
        plugin: 'warning-plugin',
      });
    });

    const compiler = getCompiler({
      devtool: 'source-map',
      entry: {
        foo: `${__dirname}/fixtures/sourcemap/foo.scss`,
      },
      module: {
        rules: [
          {
            test: /.s?css$/i,
            use: [
              MiniCssExtractPlugin.loader,
              { loader: 'css-loader', options: { sourceMap: true } },
              { loader: 'sass-loader', options: { sourceMap: true } },
            ],
          },
        ],
      },
    });

    new CssMinimizerPlugin({
      sourceMap: true,
      parallel: false,
      minify: [
        async (data) => {
          const [[fileName, input]] = Object.entries(data);

          return postcss([plugin])
            .process(input, { from: fileName, to: fileName })
            .then((result) => {
              return {
                css: result.css,
                map: result.map,
                error: result.error,
                warnings: result.warnings(),
              };
            });
        },
        async (data) => {
          const [[fileName, input]] = Object.entries(data);

          return postcss([plugin])
            .process(input, { from: fileName, to: fileName })
            .then((result) => {
              return {
                css: result.css,
                map: result.map,
                error: result.error,
                warnings: result.warnings(),
              };
            });
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readAssets(compiler, stats, /\.css(\.map)?$/)).toMatchSnapshot(
      'assets'
    );
    expect(getErrors(stats)).toMatchSnapshot('error');
    expect(getWarnings(stats)).toMatchSnapshot('warning');
  });
});
