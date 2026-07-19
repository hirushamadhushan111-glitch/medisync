/**
 * OOP Concept: Abstraction + Encapsulation + Inheritance
 *
 * BaseService is an abstract base class that encapsulates
 * common CRUD operations for any Mongoose model.
 * Subclasses inherit these methods and can override them
 * (Polymorphism) to add model-specific behaviour.
 *
 * This pattern is known as the Repository / Service Pattern.
 */

const { NotFoundError, ValidationError } = require('../utils/AppError');

class BaseService {
  /**
   * @param {mongoose.Model} model  - The Mongoose model this service manages
   * @param {string}         name   - Human-readable resource name for error messages
   */
  constructor(model, name) {
    if (new.target === BaseService) {
      throw new Error('BaseService is abstract and cannot be instantiated directly.');
    }
    this.model = model;   // Encapsulated — only accessible within the class hierarchy
    this.name  = name;
  }

  // ── CREATE ────────────────────────────────────────────────────
  async create(data) {
    const doc = await this.model.create(data);
    return doc;
  }

  // ── READ ONE ──────────────────────────────────────────────────
  async findById(id, populate = '') {
    if (!id) throw new ValidationError(`${this.name} ID is required.`);
    const doc = populate
      ? await this.model.findById(id).populate(populate)
      : await this.model.findById(id);
    if (!doc) throw new NotFoundError(this.name);
    return doc;
  }

  // ── READ MANY ─────────────────────────────────────────────────
  async findAll(filter = {}, options = {}) {
    const { sort = '-createdAt', limit = 100, populate = '' } = options;
    let query = this.model.find(filter).sort(sort).limit(limit);
    if (populate) query = query.populate(populate);
    return query;
  }

  // ── UPDATE ────────────────────────────────────────────────────
  async updateById(id, data) {
    if (!id) throw new ValidationError(`${this.name} ID is required.`);
    const doc = await this.model.findByIdAndUpdate(id, data, {
      new: true,           // return updated document
      runValidators: true, // run Mongoose schema validators
    });
    if (!doc) throw new NotFoundError(this.name);
    return doc;
  }

  // ── DELETE ────────────────────────────────────────────────────
  async deleteById(id) {
    if (!id) throw new ValidationError(`${this.name} ID is required.`);
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundError(this.name);
    await doc.deleteOne();
    return { message: `${this.name} deleted successfully.` };
  }

  // ── COUNT ─────────────────────────────────────────────────────
  async count(filter = {}) {
    return this.model.countDocuments(filter);
  }
}

module.exports = BaseService;
