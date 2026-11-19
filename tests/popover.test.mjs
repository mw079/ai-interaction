import test from 'node:test';
import assert from 'node:assert/strict';
import {positionPopover} from '../public/composer/popover.js';
test('popover remains within a compact viewport',()=>{const p=positionPopover({left:310,top:200,bottom:225,width:50},304,240,375,700);assert.ok(p.left>=16);assert.ok(p.left+p.width<=359);assert.ok(p.top+240<=684);assert.equal(p.side,'below');assert.ok(p.arrow>=22&&p.arrow<=p.width-22);});
test('popover flips above near the bottom rather than covering its anchor',()=>{const p=positionPopover({left:400,top:680,bottom:702,width:80},304,240,900,740);assert.equal(p.side,'above');assert.ok(p.top+240<680);});
test('tall content and edge anchors are clamped',()=>{const p=positionPopover({left:0,top:5,bottom:25,width:10},304,600,320,400);assert.equal(p.left,16);assert.equal(p.width,288);assert.ok(p.top>=16);});
