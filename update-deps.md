# Update Dependencies to Fix TypeScript ESLint Compatibility

## Issue
You're getting a warning about TypeScript version compatibility:
```
WARNING: You are currently running a version of TypeScript which is not officially supported by @typescript-eslint/typescript-estree.

SUPPORTED TYPESCRIPT VERSIONS: >=4.3.5 <5.4.0
YOUR TYPESCRIPT VERSION: 5.9.2
```

## Solution
I've updated your `package.json` with compatible versions. Now run:

```bash
npm install
```

## Updated Dependencies
- `@typescript-eslint/eslint-plugin`: `^7.0.0` (supports TypeScript 5.9.2)
- `@typescript-eslint/parser`: `^7.0.0` (supports TypeScript 5.9.2)
- `eslint`: `^9.0.0` (compatible with newer TypeScript ESLint)
- `eslint-config-prettier`: `^10.0.0` (compatible with ESLint 9)
- `eslint-plugin-prettier`: `^6.0.0` (compatible with ESLint 9)

## After Installation
Run the format command to verify everything works:
```bash
npm run format:fix
```

The warning should be resolved and your code should format properly.
