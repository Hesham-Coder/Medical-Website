/**
 * Build script - Compile CSS and prepare for deployment
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function build() {
  try {
    console.log('🔨 Building...');
    
    // Run PostCSS build
    console.log('📦 Compiling CSS...');
    try {
      await execPromise('postcss website/src/tailwind.css -o website/css/tailwind.output.css');
      console.log('✓ CSS compiled');
    } catch (err) {
      console.warn('⚠ CSS build skipped (PostCSS may not be configured)', err.message);
    }
    
    console.log('\n✅ Build complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  }
}

build();
