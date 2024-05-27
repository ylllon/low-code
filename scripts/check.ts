#!/usr/bin/env zx

import type { ProcessOutput } from 'zx'
import { $ } from 'zx'

import { printObject } from './utils'


await Promise.all([$`pnpm lint`]).catch((out: ProcessOutput) => {
  printObject(out)
  throw new Error(out.stdout)
})

// await $`pnpm spellcheck`.catch((out: ProcessOutput) => {
//   console.log(out)
//
//   throw new Error(out.stdout)
// })

// await Promise.all([$`pnpm type-check`, $`pnpm lint`]).catch((out: ProcessOutput) => {
//   printObject(out)
//   throw new Error(out.stdout)
// })

// check type and stage
