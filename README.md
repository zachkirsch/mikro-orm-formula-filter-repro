# MikroORM repro for formula-based filters causing SQL syntax errors

Github issue: https://github.com/mikro-orm/mikro-orm/issues/6620

To run the tests (including the failing test):

```
npm install
npm run test
```

You can see the failing test here: [src/formulaBasedFilter.test.ts](src/formulaBasedFilter.test.ts#L84-L104).
