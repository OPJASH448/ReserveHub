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

// Create resource is open to all logged-in members of the org
router.post('/', createResource);

// Update and Delete permissions are evaluated inside the controllers dynamically
router.put('/:id', updateResource);
router.delete('/:id', deleteResource);

// Read resources and generated slots are available to any authenticated org member
router.get('/', getResources);
router.get('/:id', getResourceById);
router.get('/:id/slots', getResourceSlots);

module.exports = router;
