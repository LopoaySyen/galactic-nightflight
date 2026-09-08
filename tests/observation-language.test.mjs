import assert from 'node:assert/strict';
import test from 'node:test';
import {translateObservation} from '../lib/i18n/observation.ts';
import {starName} from '../lib/rendering/observed-star-interaction.ts';
import {deepSkyTargets} from '../lib/rendering/sky-object-catalog.ts';
import {observerPresets} from '../lib/rendering/observer-presets.ts';
import {observationTutorialSteps} from '../lib/rendering/observation-tutorial.ts';

test('catalogue objects, position presets and tutorial text all have English presentation',()=>{
  for(const target of deepSkyTargets) for(const field of ['name','kind','description']) assert.doesNotMatch(translateObservation(target[field],'en'),/\p{Script=Han}/u,target[field]);
  for(const preset of observerPresets) for(const field of ['name','description']) assert.doesNotMatch(translateObservation(preset[field],'en'),/\p{Script=Han}/u,preset[field]);
  for(const step of observationTutorialSteps) for(const field of ['title','body']) assert.doesNotMatch(translateObservation(step[field],'en'),/\p{Script=Han}/u,step[field]);
});
test('translation preserves catalogue identifiers and measured values',()=>{
  assert.equal(translateObservation('依巴谷 32349','en'),'HIP 32349');
  assert.equal(translateObservation('HIP 32349','en'),'HIP 32349');
  assert.equal(translateObservation('−12,345 年','en'),'−12,345 yr');
  assert.equal(translateObservation('银河中心','zh'),'银河中心');
  assert.equal(starName('Sirius','en'),'Sirius');
  assert.equal(starName('Sirius','zh'),'天狼星');
});
