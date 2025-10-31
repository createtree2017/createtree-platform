import { selectWeightedPrompts } from './server/services/snapshotPromptService';

async function testFamilyPromptSelection() {
  console.log('🧪 Testing family prompt selection...\n');

  try {
    // Test 1: Daily family prompts
    console.log('Test 1: Selecting daily family prompts');
    const dailyPrompts = await selectWeightedPrompts({
      category: 'family',
      type: 'daily',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${dailyPrompts.length} daily family prompts`);
    console.log(`Sample: ${dailyPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 2: Travel family prompts
    console.log('Test 2: Selecting travel family prompts');
    const travelPrompts = await selectWeightedPrompts({
      category: 'family',
      type: 'travel',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${travelPrompts.length} travel family prompts`);
    console.log(`Sample: ${travelPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 3: Film family prompts
    console.log('Test 3: Selecting film family prompts');
    const filmPrompts = await selectWeightedPrompts({
      category: 'family',
      type: 'film',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${filmPrompts.length} film family prompts`);
    console.log(`Sample: ${filmPrompts[0].prompt.substring(0, 100)}...`);
    console.log('');

    // Test 4: Mix family prompts
    console.log('Test 4: Selecting mix family prompts');
    const mixPrompts = await selectWeightedPrompts({
      category: 'family',
      type: 'mix',
      gender: null,
      count: 5
    });
    console.log(`✅ Retrieved ${mixPrompts.length} mix family prompts`);
    console.log('Actual styles used:', mixPrompts.map(p => p.actualStyle).join(', '));
    console.log('');

    // Verify all prompts have face preservation
    const allPrompts = [...dailyPrompts, ...travelPrompts, ...filmPrompts];
    const withFacePreservation = allPrompts.filter(p => 
      p.prompt.includes('Preserve the exact facial features and identities of all family members from the reference images')
    );
    console.log(`✅ Face preservation check: ${withFacePreservation.length}/${allPrompts.length} prompts`);
    
    if (withFacePreservation.length === allPrompts.length) {
      console.log('\n🎉 All tests passed! Family prompts are working correctly!');
    } else {
      console.log('\n❌ Some prompts missing face preservation directive!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testFamilyPromptSelection()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
