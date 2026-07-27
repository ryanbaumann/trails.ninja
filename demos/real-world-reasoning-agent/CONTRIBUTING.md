# Contributing

Thanks for your interest in Atlas! This is a demo project, so contributions are kept lightweight:

1. Fork the repo and create a feature branch.
2. Follow the setup in [README.md](README.md) (Node 22+, `.env` from `.env.example`).
3. Before opening a PR, make sure `npm run typecheck` and `npm run build` pass.
4. Keep changes focused; open an issue first for anything large.

Never commit API keys or `.env` files — CI runs secret scanning on every push. For security issues, see [SECURITY.md](SECURITY.md) instead of opening a public issue.
