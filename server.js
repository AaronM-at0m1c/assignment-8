const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { db, Project, Task, User } = require('./database/setup');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ID validation middleware to prevent injection
const idValidation = (field) => (req, res, next) => {
    if (!/^\d+$/.test(req.params[field])) {
        return res.status(400).json({ error: `${field} must contain digits only` });
    }
    next();
};

// Error handle invaid json body
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// Data validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
        const errorMessages =
    errors.array().map(error => error.msg);
    
        return res.status(400).json({
            error: 'Validation failed',
            messages: errorMessages
        });
    }
  
    // Set default value for completed if not provided
    if (req.body.completed === undefined) {
        req.body.completed = false;
    }
  
    next();
};

// Validation rules
const projectValidation = [
  body()
  .custom((body) => {
    if (Object.keys(body).length > 4) {
    }
    return true;
  })
    .withMessage('Request must only contain the following fields: name, description, status, due-date.'),
  body('name')
    .isLength({ min: 1 })
    .withMessage('Project name cannot be null'),
  
  body('description')
    .isLength({ min: 1 })
    .withMessage('Description cannot be null'),
  
  body('status')
    .isLength({ min: 1 })
    .withMessage('Status cannot be null'),

  body('due-date')
    .matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .withMessage('Due-date must be in YYYY-MM-DD format, e.g. 2024-12-31'),

  body('userId')
    .isInt({ min: 1 })
    .withMessage('UserId must be a positive number'),
];

const taskValidation = [
  body()
  .custom((body) => {
    if (Object.keys(body).length > 4) {
    }
    return true;
  })
    .withMessage('Request must only contain the following fields: name, description, status, due-date.'),
  body('title')
    .isLength({ min: 1 })
    .withMessage('Title cannot be null'),
  
  body('description')
    .isLength({ min: 1 })
    .withMessage('Description cannot be null'),
  
  body('completed')
    .isBoolean()
    .withMessage('Completed status must be either true or false'),

  body('priority')
    .isLength({ min: 1 })
    .withMessage('Priority cannot be null'),

  body('due-date')
    .matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
    .withMessage('Due-date must be in YYYY-MM-DD format, e.g. 2024-12-31'),

  body('projectId')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive number'),
];


// Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {  
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        req.user = {
            id: req.session.userId,
            name: req.session.userName,
            email: req.session.userEmail
        };
        next();
    } else {
        res.status(401).json({ 
            error: 'Authentication required. Please log in.' 
        });
    }
}

// Test database connection
async function testConnection() {
    try {
        await db.authenticate();
        console.log('Connection to database established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

testConnection();

// PROJECT ROUTES

// GET /api/projects - Get all projects
app.get('/api/projects', requireAuth, async (req, res) => {
    try {
        const projects = await Project.findAll();
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// GET /api/projects/:id - Get project by ID
app.get('/api/projects/:id', idValidation('id'), async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// POST /api/projects - Create new project
app.post('/api/projects', projectValidation, handleValidationErrors, async (req, res) => {
    try {
        const { name, description, status, userId } = req.body;
        const dueDate = req.body['due-date'];
        
        const newProject = await Project.create({
            name,
            description,
            status,
            dueDate,
            userId
        });
        
        res.status(201).json(newProject);
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// PUT /api/projects/:id - Update existing project
app.put('/api/projects/:id', idValidation('id'), projectValidation, handleValidationErrors, async (req, res) => {
    try {
        const { name, description, status, userId } = req.body;
        const dueDate = req.body['due-date'];
        
        const [updatedRowsCount] = await Project.update(
            { name, description, status, dueDate, userId },
            { where: { id: req.params.id } }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        const updatedProject = await Project.findByPk(req.params.id);
        res.json(updatedProject);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// DELETE /api/projects/:id - Delete project
app.delete('/api/projects/:id', idValidation('id'), async (req, res) => {
    try {
        const deletedRowsCount = await Project.destroy({
            where: { id: req.params.id }
        });
        
        if (deletedRowsCount === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// TASK ROUTES

// GET /api/tasks - Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await Task.findAll();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// GET /api/tasks/:id - Get task by ID
app.get('/api/tasks/:id', idValidation('id'), async (req, res) => {
    try {
        const task = await Task.findByPk(req.params.id);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// POST /api/tasks - Create new task
app.post('/api/tasks', taskValidation, handleValidationErrors, async (req, res) => {
    try {
        const { title, description, completed, priority, projectId } = req.body;
        const dueDate = req.body['due-date'];
        
        const newTask = await Task.create({
            title,
            description,
            completed,
            priority,
            dueDate,
            projectId
        });
        
        res.status(201).json(newTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// PUT /api/tasks/:id - Update existing task
app.put('/api/tasks/:id', idValidation('id'), taskValidation, handleValidationErrors, async (req, res) => {
    try {
        const { title, description, completed, priority, projectId } = req.body;
        const dueDate = req.body['due-date'];
        
        const [updatedRowsCount] = await Task.update(
            { title, description, completed, priority, dueDate, projectId },
            { where: { id: req.params.id } }
        );
        
        if (updatedRowsCount === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const updatedTask = await Task.findByPk(req.params.id);
        res.json(updatedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// DELETE /api/tasks/:id - Delete task
app.delete('/api/tasks/:id', idValidation('id'), async (req, res) => {
    try {
        const deletedRowsCount = await Task.destroy({
        where: { id: req.params.id }
        });
        
        if (deletedRowsCount === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// POST /api/register - Register new user
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user with this email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        // Hash password for storage
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create new user with hash
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword
        });
        
        // Successful registration
        res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email
        }
        });
        
    } catch (error) {
        console.error('Error registering:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// POST /api/login - Existing user login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user via email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        console.log(user.password)
        // Compare provided password with hashed password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create session if password is correct
        req.session.userId = user.id;
        req.session.userName = user.username;
        req.session.userEmail = user.email;
        
        // Password is correct - user is authenticated
        res.json({
        message: 'Login successful',
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        }
        });
        
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if(err) {
            console.error('Error destroying the session', err);
            return res.status(500).json({ error: 'Logout failed' })
        }

        res.json({ message: "Logout successful" })
    })
})


// Start server
app.listen(PORT, () => {
    console.log(`Server running on port http://localhost:${PORT}`);
});