const express = require('express');
const router = express.Router();
const { authenticateToken, requireOrgAdmin } = require('../middleware/auth');
const { 
  createResource, 
  getResources, 
  getResourceById, 
  updateResource, 
  deleteResource, 
  getResourceSlots 
} = require('../controllers/resourceController');

// All resource routes require authentication
router.use(authenticateToken);

// Create, Update, Delete are restricted to OrgAdmin (rank 0)
router.post('/', requireOrgAdmin, createResource);
router.put('/:id', requireOrgAdmin, updateResource);
router.delete('/:id', requireOrgAdmin, deleteResource);

// Read resources and generated slots are available to any authenticated org member
router.get('/', getResources);
router.get('/:id', getResourceById);
router.get('/:id/slots', getResourceSlots);

module.exports = router;
