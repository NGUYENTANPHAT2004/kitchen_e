// controllers/user.controller.js
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../middlewares/async.middleware');
const imageService = require('../utils/imageService');
const mongoose = require('mongoose');

/**
 * @desc    Get all users with pagination, filtering, and sorting
 * @route   GET /api/users
 * @access  Private (Admin)
 */
exports.getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sort = '-createdAt',
    search,
    role,
    isEmailVerified,
    authProvider,
    isDeleted,
    ...otherFilters
  } = req.query;

  // Build query
  const query = {};

  // Search by name, email, or username
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by role
  if (role) {
    query.role = role;
  }

  // Filter by email verification status
  if (isEmailVerified !== undefined) {
    query.isEmailVerified = isEmailVerified === 'true';
  }

  // Filter by auth provider
  if (authProvider) {
    query.authProvider = authProvider;
  }

  // Filter by deleted status
  if (isDeleted !== undefined) {
    if (isDeleted === 'true') {
      // Include deleted users
      query.isDeleted = true;
    } else {
      // Only non-deleted users
      query.isDeleted = false;
    }
  } else {
    // Default to non-deleted users
    query.isDeleted = false;
  }

  // Add other filters
  for (const key in otherFilters) {
    query[key] = otherFilters[key];
  }

  // Count total users matching query
  const total = await User.countDocuments(query);

  // Pagination options
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const totalPages = Math.ceil(total / parseInt(limit));

  // Get users
  const users = await User.find(query)
    .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  return ApiResponse.success(res, {
    users,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalItems: total,
      limit: parseInt(limit)
    }
  });
});

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private (Admin or User themselves)
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is requesting their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to access this user information', 403);
  }

  // Find user
  const user = await User.findById(id)
    .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return ApiResponse.success(res, { user });
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin or User themselves)
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    phoneNumber,
    ...otherFields
  } = req.body;

  // Check if user is updating their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to update this user', 403);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Create update object for regular user fields
  const updateData = {};

  // Standard fields that any user can update about themselves
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

  // Admin-only fields
  if (req.user.role === 'admin') {
    // Allow admin to update additional fields
    const adminFields = ['role', 'isEmailVerified', 'isDeleted'];

    for (const field of adminFields) {
      if (otherFields[field] !== undefined) {
        // Handle boolean fields
        if (field === 'isEmailVerified' || field === 'isDeleted') {
          updateData[field] = otherFields[field] === 'true' || otherFields[field] === true;
        } else {
          updateData[field] = otherFields[field];
        }
      }
    }
  }

  // Handle avatar upload
  if (req.file) {
    try {
      // Delete old avatar if exists and not the default
      if (user.avatar && !user.avatar.includes('default-avatar.jpg')) {
        await imageService.deleteImage(user.avatarPath || user.avatar);
      }

      // Upload new avatar
      const result = await imageService.uploadImage(req.file, 'avatars');
      updateData.avatar = result.url;
      updateData.avatarPath = result.path;
    } catch (error) {
      throw new ApiError(`Avatar upload failed: ${error.message}`, 500);
    }
  }

  // Update user
  const updatedUser = await User.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');

  return ApiResponse.success(res, { user: updatedUser }, 'User updated successfully');
});

/**
 * @desc    Delete user (soft delete)
 * @route   DELETE /api/users/:id
 * @access  Private (Admin)
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError('Not authorized to delete users', 403);
  }

  // Check if trying to delete self
  if (id === req.user.id) {
    throw new ApiError('Cannot delete your own account', 400);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Soft delete
  user.isDeleted = true;
  await user.save();

  return ApiResponse.success(res, null, 'User deleted successfully');
});

/**
 * @desc    Restore deleted user
 * @route   PUT /api/users/:id/restore
 * @access  Private (Admin)
 */
exports.restoreUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError('Not authorized to restore users', 403);
  }

  // Find user
  const user = await User.findOne({ _id: id, isDeleted: true });

  if (!user) {
    throw new ApiError('Deleted user not found', 404);
  }

  // Restore user
  user.isDeleted = false;
  await user.save();

  return ApiResponse.success(res, { 
    user: {
      _id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  }, 'User restored successfully');
});

/**
 * @desc    Change user role
 * @route   PUT /api/users/:id/role
 * @access  Private (Admin)
 */
exports.changeUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError('Not authorized to change user roles', 403);
  }

  // Validate role
  const validRoles = ['customer', 'staff', 'admin'];
  if (!role || !validRoles.includes(role)) {
    throw new ApiError('Invalid role. Must be one of: customer, staff, admin', 400);
  }

  // Check if trying to change own role
  if (id === req.user.id) {
    throw new ApiError('Cannot change your own role', 400);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Change role
  user.role = role;
  await user.save();

  return ApiResponse.success(res, { 
    user: {
      _id: user._id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  }, 'User role updated successfully');
});

/**
 * @desc    Get user addresses
 * @route   GET /api/users/:id/addresses
 * @access  Private (Admin or User themselves)
 */
exports.getUserAddresses = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is requesting their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to access this user information', 403);
  }

  // Find user
  const user = await User.findById(id)
    .select('addresses defaultAddress');

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  return ApiResponse.success(res, { 
    addresses: user.addresses || [],
    defaultAddress: user.defaultAddress
  });
});

/**
 * @desc    Add user address
 * @route   POST /api/users/:id/addresses
 * @access  Private (Admin or User themselves)
 */
exports.addUserAddress = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    fullName,
    phone,
    address,
    city,
    state,
    postalCode,
    country = 'Vietnam',
    isDefault = false
  } = req.body;

  // Check if user is updating their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to update this user', 403);
  }

  // Validate required fields
  if (!fullName || !phone || !address || !city) {
    throw new ApiError('Please provide all required address fields', 400);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Initialize addresses array if not exists
  if (!user.addresses) {
    user.addresses = [];
  }

  // Create new address with ID
  const newAddress = {
    _id: new mongoose.Types.ObjectId(),
    fullName,
    phone,
    address,
    city,
    state: state || '',
    postalCode: postalCode || '',
    country,
    isDefault: isDefault === 'true' || isDefault === true
  };

  // If this is the first address or set as default
  if (user.addresses.length === 0 || newAddress.isDefault) {
    user.defaultAddress = newAddress._id;
    newAddress.isDefault = true;
    
    // Update other addresses to not be default
    user.addresses = user.addresses.map(addr => ({
      ...addr,
      isDefault: false
    }));
  }

  // Add new address
  user.addresses.push(newAddress);

  // Save user
  await user.save();

  return ApiResponse.created(res, { 
    address: newAddress,
    addresses: user.addresses,
    defaultAddress: user.defaultAddress
  }, 'Address added successfully');
});

/**
 * @desc    Update user address
 * @route   PUT /api/users/:id/addresses/:addressId
 * @access  Private (Admin or User themselves)
 */
exports.updateUserAddress = asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;
  const {
    fullName,
    phone,
    address,
    city,
    state,
    postalCode,
    country,
    isDefault
  } = req.body;

  // Check if user is updating their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to update this user', 403);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Find address index
  const addressIndex = user.addresses.findIndex(
    addr => addr._id.toString() === addressId
  );

  if (addressIndex === -1) {
    throw new ApiError('Address not found', 404);
  }

  // Create updated address
  const updatedAddress = {
    ...user.addresses[addressIndex].toObject(),
    ...(fullName && { fullName }),
    ...(phone && { phone }),
    ...(address && { address }),
    ...(city && { city }),
    ...(state !== undefined && { state }),
    ...(postalCode !== undefined && { postalCode }),
    ...(country && { country })
  };

  // Handle default address
  if (isDefault === 'true' || isDefault === true) {
    // Set this address as default
    updatedAddress.isDefault = true;
    user.defaultAddress = updatedAddress._id;
    
    // Update other addresses to not be default
    user.addresses = user.addresses.map(addr => ({
      ...addr.toObject(),
      isDefault: addr._id.toString() === addressId
    }));
  }

  // Update address
  user.addresses[addressIndex] = updatedAddress;

  // Save user
  await user.save();

  return ApiResponse.success(res, { 
    address: updatedAddress,
    addresses: user.addresses,
    defaultAddress: user.defaultAddress
  }, 'Address updated successfully');
});

/**
 * @desc    Delete user address
 * @route   DELETE /api/users/:id/addresses/:addressId
 * @access  Private (Admin or User themselves)
 */
exports.deleteUserAddress = asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;

  // Check if user is updating their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to update this user', 403);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Find address
  const address = user.addresses.find(
    addr => addr._id.toString() === addressId
  );

  if (!address) {
    throw new ApiError('Address not found', 404);
  }

  // Remove address
  user.addresses = user.addresses.filter(
    addr => addr._id.toString() !== addressId
  );

  // If deleted address was default, set a new default if available
  if (user.defaultAddress && user.defaultAddress.toString() === addressId) {
    if (user.addresses.length > 0) {
      user.defaultAddress = user.addresses[0]._id;
      user.addresses[0].isDefault = true;
    } else {
      user.defaultAddress = undefined;
    }
  }

  // Save user
  await user.save();

  return ApiResponse.success(res, { 
    addresses: user.addresses,
    defaultAddress: user.defaultAddress
  }, 'Address deleted successfully');
});

/**
 * @desc    Set default address
 * @route   PUT /api/users/:id/addresses/:addressId/default
 * @access  Private (Admin or User themselves)
 */
exports.setDefaultAddress = asyncHandler(async (req, res) => {
  const { id, addressId } = req.params;

  // Check if user is updating their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to update this user', 403);
  }

  // Find user
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  // Find address
  const address = user.addresses.find(
    addr => addr._id.toString() === addressId
  );

  if (!address) {
    throw new ApiError('Address not found', 404);
  }

  // Update all addresses
  user.addresses = user.addresses.map(addr => ({
    ...addr.toObject(),
    isDefault: addr._id.toString() === addressId
  }));

  // Set default address ID
  user.defaultAddress = address._id;

  // Save user
  await user.save();

  return ApiResponse.success(res, { 
    addresses: user.addresses,
    defaultAddress: user.defaultAddress
  }, 'Default address updated successfully');
});

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('-password -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');

  return ApiResponse.success(res, { user });
});

/**
 * @desc    Get user orders summary
 * @route   GET /api/users/:id/orders-summary
 * @access  Private (Admin or User themselves)
 */
exports.getUserOrdersSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if user is requesting their own info or is admin
  if (id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError('Not authorized to access this user information', 403);
  }

  // Count orders by status
  const Order = require('../models/Order');
  const orderCounts = await Order.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(id), isDeleted: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Format counts
  const orderSummary = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0
  };

  orderCounts.forEach(item => {
    orderSummary[item._id] = item.count;
    orderSummary.total += item.count;
  });

  // Get recent orders
  const recentOrders = await Order.find({ userId: id, isDeleted: false })
    .sort('-createdAt')
    .limit(5)
    .select('orderNumber status totalAmount createdAt isPaid')
    .lean();

  // Calculate total spent
  const totalSpent = await Order.aggregate([
    { 
      $match: { 
        userId: new mongoose.Types.ObjectId(id), 
        status: { $in: ['delivered', 'shipped'] },
        isPaid: true
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  return ApiResponse.success(res, {
    orderSummary,
    recentOrders,
    totalSpent: totalSpent.length > 0 ? totalSpent[0].total : 0
  });
});

/**
 * @desc    Search users
 * @route   GET /api/users/search
 * @access  Private (Admin)
 */
exports.searchUsers = asyncHandler(async (req, res) => {
  const { query = '', limit = 10 } = req.query;

  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError('Not authorized to search users', 403);
  }

  // Search users
  const users = await User.find({
    $or: [
      { firstName: { $regex: query, $options: 'i' } },
      { lastName: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } },
      { username: { $regex: query, $options: 'i' } },
      { phoneNumber: { $regex: query, $options: 'i' } }
    ],
    isDeleted: false
  })
    .select('firstName lastName email username phoneNumber avatar role')
    .limit(parseInt(limit));

  return ApiResponse.success(res, {
    users,
    count: users.length,
    query
  });
});

/**
 * @desc    Get user statistics (admin dashboard)
 * @route   GET /api/users/stats
 * @access  Private (Admin)
 */
exports.getUserStats = asyncHandler(async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    throw new ApiError('Not authorized to view user statistics', 403);
  }

  // Get total users count
  const totalUsers = await User.countDocuments({ isDeleted: false });

  // Get users count by role
  const usersByRole = await User.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  // Get users count by auth provider
  const usersByProvider = await User.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$authProvider', count: { $sum: 1 } } }
  ]);

  // Get new users in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const newUsers = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
    isDeleted: false
  });

  // Get user registration trend by day (last 30 days)
  const userTrend = await User.aggregate([
    { 
      $match: { 
        createdAt: { $gte: thirtyDaysAgo },
        isDeleted: false
      } 
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return ApiResponse.success(res, {
    totalUsers,
    newUsers,
    usersByRole: usersByRole.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    usersByProvider: usersByProvider.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    userTrend
  });
});