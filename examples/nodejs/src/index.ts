import * as procedures from './procedures'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

while (true) {
  console.log('\nAvailable procedures:')
  Object.entries(procedures).forEach(([key, proc], index) => {
    console.log(`${index + 1}. ${proc.name || key}`)
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question(`\nSelect a procedure: `, resolve)
  })

  const selectedIndex = parseInt(answer) - 1
  const procedureKeys = Object.keys(procedures)

  if (selectedIndex >= 0 && selectedIndex < procedureKeys.length) {
    // @ts-expect-error
    await procedures[procedureKeys[selectedIndex]].procedure()
  } else {
    console.log('Invalid selection')
  }
}
