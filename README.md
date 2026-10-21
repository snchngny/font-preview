# フォント比較

日本語と欧文のフォントを並べて比較する静的ページです

## ビルドと公開

Node.jsで次を実行すると、公開用ファイルが `dist/` に作られます

```powershell
node build-site.mjs
```

Cloudflare Pagesではビルドコマンドに `node build-site.mjs`、出力先に `dist` を指定します。生成物は依存パッケージを使わず、HTML、CSS、フォント、ライセンス資料で構成されます

## データの扱い

入力した文章はこのタブ内で処理し、追加したフォントだけをこのブラウザーのIndexedDBに保存します。どちらもサーバーへ送信せず、アクセス解析は行いません

## オフライン確認

`node build-fonts.mjs` でローカル確認用CSSを生成し、`index.html` を直接開きます。`bundled-fonts.css` は全フォントを埋め込むため、公開用ビルドでは使いません
