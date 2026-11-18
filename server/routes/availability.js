const router = require('express').Router();
const {Schedule,Rule,Mirror} = require('../models/Availability');
const {validateWeekly,validateRule} = require('../utils/availabilityRules');
const {settings} = require('../utils/availability');
router.get('/', async (req,res) => {
  try {const [schedule,rules,mirrors] = await Promise.all([settings(),Rule.find({deleted:false}).sort({fromDate:1}).lean(),Mirror.find().select('error updatedAt').lean()]);res.json({schedule,rules,syncErrors:[...(schedule.syncError?[schedule.syncError]:[]),...mirrors.filter(m=>m.error).map(m=>m.error)]});}
  catch {res.status(503).json({error:'Unable to load availability'});}
});
router.put('/weekly', async (req,res) => {
  try {
    const weekly=validateWeekly(req.body.weekly);
    if (!Number.isInteger(req.body.revision)) throw new Error('Refresh availability and try again');
    const saved=await Schedule.findOneAndUpdate({_id:'saunaman',revision:req.body.revision},{$set:{weekly},$inc:{revision:1}},{new:true,upsert:req.body.revision===0,runValidators:true});
    if (!saved) return res.status(409).json({error:'Schedule changed. Refresh before saving.'});
    res.json(saved);
  } catch(e) {res.status(e.code===11000?409:400).json({error:e.code===11000?'Schedule changed. Refresh before saving.':e.message});}
});
router.post('/rules', async (req,res) => {
  try {res.status(201).json(await Rule.create(validateRule(req.body)));}
  catch(e) {res.status(400).json({error:e.message});}
});
router.put('/rules/:id', async (req,res) => {
  try {
    const values=validateRule(req.body);
    const saved=await Rule.findOneAndUpdate({_id:req.params.id,deleted:false,revision:req.body.revision},{$set:values,$inc:{revision:1}},{new:true,runValidators:true});
    if (!saved) return res.status(409).json({error:'Window changed. Refresh before editing.'});
    res.json(saved);
  } catch(e) {res.status(400).json({error:e.message});}
});
router.delete('/rules/:id', async (req,res) => {
  try {await Rule.updateOne({_id:req.params.id},{$set:{deleted:true},$inc:{revision:1}});res.json({deleted:true});}
  catch {res.status(503).json({error:'Unable to remove window'});}
});
module.exports=router;
