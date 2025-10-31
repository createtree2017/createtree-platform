import { selectWeightedPrompts } from './server/services/snapshotPromptService';

async function testCouplePromptSelection() {
  console.log('🧪 Testing couple prompt selection...\n');

  try {
    // Test 1: Daily couple prompts
    console.log('Test 1: Selecting daily couple prompts');
    const dailyPrompts = await selectWeightedPrompts({
      category: 'couple',
      type: 'daily',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${dailyPrompts.length} daily couple prompts`);
    console.log(`Sample prompt: ${dailyPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 2: Travel couple prompts
    console.log('Test 2: Selecting travel couple prompts');
    const travelPrompts = await selectWeightedPrompts({
      category: 'couple',
      type: 'travel',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${travelPrompts.length} travel couple prompts`);
    console.log(`Sample prompt: ${travelPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 3: Film couple prompts
    console.log('Test 3: Selecting film couple prompts');
    const filmPrompts = await selectWeightedPrompts({
      category: 'couple',
      type: 'film',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${filmPrompts.length} film couple prompts`);
    console.log(`Sample prompt: ${filmPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 4: Mix couple prompts
    console.log('Test 4: Selecting mix couple prompts');
    const mixPrompts = await selectWeightedPrompts({
      category: 'couple',
      type: 'mix',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${mixPrompts.length} mix couple prompts`);
    console.log('Actual styles used:', mixPrompts.map(p => p.actualStyle).join(', '));
    console.log('');

    // Verify all prompts have face preservation
    const allPrompts = [...dailyPrompts, ...travelPrompts, ...filmPrompts];
    const withFacePreservation = allPrompts.filter(p => 
      p.prompt.includes('Preserve the exact facial features and identities of both people from the reference images')
    );
    console.log(`✅ Face preservation check: ${withFacePreservation.length}/${allPrompts.length} prompts`);
    
    if (withFacePreservation.length === allPrompts.length) {
      console.log('\n🎉 All tests passed! Couple prompts are working correctly!');
    } else {
      console.log('\n❌ Some prompts missing face preservation directive!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testCouplePromptSelection()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
