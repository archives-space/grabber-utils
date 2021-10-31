const fs = require('fs')
const path = require('path')
const { argv, exit } = require('process')
const prompt = require('prompt')

if (argv.length < 3) {
  console.error('Usage: node remove_corrupted.js <directory>')
  exit(1)
}

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

readline.question(`Confirm?`, confirm => {
  if (confirm === 'y') {

    const folder = path.resolve(argv[2])
    console.log(`Inspecting ${folder}`)
    
    fs.readdirSync(folder).forEach((file) => {
      if (file.endsWith('.tmp')) {
        console.log(`> Deleted ${file}`)
        fs.unlinkSync(folder + '/' + file)
      }
    })
    
    console.log('')
    console.log('Thanks you')
    exit(0)
  }
  console.log('Aborted')
  exit(1)
  readline.close()
})
