# Deploy dragonPDF (GitHub → Vercel auto-deploy)

Once this is set up **once**, every `git push` to `main` deploys automatically.

## One-time setup (recommended)

1. Open [vercel.com/new](https://vercel.com/new) and sign in with **GitHub**.
2. Import **`ktiwari54/PDF`**.
3. Settings (auto-detected):
   - Framework: **Vite**
   - Build: `npm run build`
   - Output: `dist`
4. Click **Deploy**.

### Enable auto-deploy

- Project → **Settings → Git**
- Connected repo: `ktiwari54/PDF`
- Production branch: **`main`**

After that:

```bash
git add -A
git commit -m "your message"
git push origin main
```

→ Vercel rebuilds and updates the live site.

## CLI deploy (optional)

```bash
npx vercel login
npx vercel link          # link to the same project
npx vercel --prod        # deploy production
```

Or use a token:

```bash
npx vercel --prod --token YOUR_VERCEL_TOKEN
```

Create a token: [vercel.com/account/tokens](https://vercel.com/account/tokens)

## Project URLs

- GitHub: https://github.com/ktiwari54/PDF
- Vercel dashboard: https://vercel.com/dashboard
