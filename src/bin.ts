#!/usr/bin/env node

import chalk from 'chalk'
import execa from 'execa'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import L from 'lodash'
import ora from 'ora'
import path from 'path'
import parser from 'yargs-parser'
import URL from 'url'

const help = `Please specify a package to add.

$ hygen-add <PATH|PACKAGE> [--name NAME] [--prefix PREFIX] [--exact]
 
     PATH: path relative to CWD that contains a '_templates' directory 
           - note: PATH is always checked before PACKAGE 
  PACKAGE: npm module installed locally or globally
           - note: for an npm module named 'hygen-react', PACKAGE is 'react'
           - note: ./node_modules & ~/.npm-global/lib/node_modules are searched
   --name: package name for a Git repo when cannot infer from repo URL (optional)
 --prefix: prefix added generators, avoids clashing names (optional)
  --exact: looks for PACKAGE instead of hygen-PACKAGE
 
 When found, the templates will be copied to $HYGEN_TMPLS or './_templates' and 
 renamed as necessary to honor --name and --prefix.
 
 Examples
 $ hygen-add ~/.local/templates
 ->  template_path = ~/.local/templates
  
 $ hygen-add cra 
 ->  searches for first directory that exists in this order: 
       ./cra
       ./node_modules/hygen-cra
       ~/.npm-global/lib/node_modules/hygen-cra
       
 $ hygen-add canvas --exact
 ->  searches for first directory that exists in this order:
       ./canvas
       ./node_models/canvas
       ./.npm-global/lib/node_modules/canvas
`
const globalPath = process.env.NPM_CONFIG_PREFIX ||  '~/.npm-global/lib/node_modules'
const destRootPath = path.join(__dirname, process.env.HYGEN_TMPLS || '_templates')

const tmpl = x => path.join(destRootPath, x)

const resolvePackage = (pkg, opts) => {
  const pkgName = opts.exact ? pkg : `hygen-${pkg}`
  const dirList = [
      path(pkg),
      path(pkg, '_templates'),
      path.join(__dirname, pkg),
      path.join(__dirname, pkg, '_templates'),
      path.join(__dirname, 'node_modules', pkgName, '_templates'),
      path.join(globalPath, pkgName, '_templates'),
  ]

  // not sure if this is
  const srcPath = dirList.find(p => fs.existsSync(p))

  // or some other way to say we didn't find it
  if (!srcPath) return {error: 'error'}

  return {
    name: pkgName,
    srcPath: srcPath
  }
}

const main = async () => {
  const { red, green, yellow } = chalk
  const args = parser(process.argv.slice(2))
  const [pkgdest] = args._
  if (!pkg) {
    console.log(help)
    process.exit(1)
  }
  const { name, srcPath } = resolvePackage(pkg, args)
  if (!srcPath) {
    console.log(`${pkg} not found`)
    process.exit(1)
  }
  const spinner = ora(`Adding: ${name}`).start()

  try {
    const templatePath = path.join('./node_modules', name, '_templates')

    await fs.mkdirp(destRootPath)

    spinner.stop()
    for (const g of await fs.readdir(srcPath)) {
      const maybePrefixed = args.prefix ? `${args.prefix}-${g}` : g
      const wantedTargetPath = tmpl(maybePrefixed)
      const sourcePath = path.join(srcPath, g)

      if (await fs.pathExists(wantedTargetPath)) {
        if (
          !await inquirer
            .prompt([
              {
                message: `'${maybePrefixed}' already exists. Overwrite? (Y/n): `,
                name: 'overwrite',
                prefix: '      🤔 :',
                type: 'confirm'
              }
            ])
            .then(({ overwrite }) => overwrite)
        ) {
          console.log(yellow(` skipped: ${maybePrefixed}`))
          continue
        }
      }

      await fs.copy(sourcePath, wantedTargetPath, {
        recursive: true
      })
      console.log(green(`   added: ${maybePrefixed}`))
    }
  } catch (ex) {
    console.log(
      red(`\n\nCan't add ${name}${isUrl ? ` (source: ${pkg})` : ''}\n\n`),
      ex
    )
  }
}

main()
