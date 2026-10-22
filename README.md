# フォント比較

日本語と欧文のフォントを並べて比較する静的ページです

公開サイト：https://font-preview-dun.pages.dev

## 作業場所とローカル確認

正本はこの `apps/font-preview/` だけです。旧試作フォルダーは使用しません。

変更後は先にローカルで確認します。このフォルダーで次を実行し、`index.html` をブラウザーで開きます。

```powershell
node build-fonts.mjs
node verify-fonts.mjs
```

生成する `bundled-fonts.css` はローカル確認用で、Gitには含めません。

## 公開

ローカルで利用者が確認し、pushを明示的に指示した版だけをpushします。修正依頼やローカルcommitをpushの許可とは扱いません。

Node.jsで次を実行すると、公開用ファイルが `dist/` に作られます

```powershell
node build-site.mjs
```

Cloudflare Pagesではビルドコマンドに `node build-site.mjs`、出力先に `dist` を指定します。生成物は依存パッケージを使わず、HTML、CSS、フォント、ライセンス資料で構成されます

GitHubリポジトリは非公開、サイトは一般公開です。`main` へのpushでCloudflare Pagesがサイトを自動更新します。pushとサイト更新は一緒に行い、別の公開操作は要求しません。確認前のpushや、指示のないpushは行いません。

OS表示は元書体が一般的に使われる環境の目安で、閲覧端末の判定ではありません。各カードには、このブラウザーで読み込めた元書体・代替書体と利用可能な太さを表示します。

## データの扱い

入力した文章はこのタブ内だけで処理します。フォントの追加・保存機能はなく、アクセス解析も行いません
