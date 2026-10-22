# フォント比較

日本語と欧文のフォントを並べて比較する静的ページです

公開サイト：https://font-preview-dun.pages.dev

## ビルドと公開

Node.jsで次を実行すると、公開用ファイルが `dist/` に作られます

```powershell
node build-site.mjs
```

Cloudflare Pagesではビルドコマンドに `node build-site.mjs`、出力先に `dist` を指定します。生成物は依存パッケージを使わず、HTML、CSS、フォント、ライセンス資料で構成されます

GitHubリポジトリは非公開、サイトは一般公開です。`main` へのpushでCloudflare Pagesが自動更新します

OS表示は元書体が一般的に使われる環境の目安で、閲覧端末の判定ではありません。各カードには、このブラウザーで読み込めた元書体・代替書体と利用可能な太さを表示します。

## データの扱い

入力した文章はこのタブ内で処理し、追加したフォントだけをこのブラウザーのIndexedDBに保存します。どちらもサーバーへ送信せず、アクセス解析は行いません

## オフライン確認

`node build-fonts.mjs` でローカル確認用CSSを生成し、`index.html` を直接開きます。`bundled-fonts.css` は全フォントを埋め込むため、公開用ビルドでは使いません
