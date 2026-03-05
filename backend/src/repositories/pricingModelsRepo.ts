import { PricingModel, CreatePricingModelInput } from '../types/models';
import { query } from '../db';

// Map database row to PricingModel object
function rowToPricingModel(row: any): PricingModel {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    billingBasis: row.billing_basis,
    currency: row.currency,
    unitPrice: parseFloat(row.unit_price),
    minUnits: row.min_units || undefined,
    maxUnits: row.max_units || undefined,
    notes: row.notes || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function getPricingModels(): Promise<PricingModel[]> {
  try {
    const result = await query<any>(
      'SELECT * FROM pricing_models ORDER BY name ASC'
    );
    return result.rows.map(rowToPricingModel);
  } catch (error) {
    console.error('Error fetching pricing models:', error);
    throw error;
  }
}

export async function getPricingModelById(id: string): Promise<PricingModel | null> {
  try {
    const result = await query<any>(
      'SELECT * FROM pricing_models WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? rowToPricingModel(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching pricing model by ID:', error);
    throw error;
  }
}

export async function createPricingModel(input: CreatePricingModelInput): Promise<PricingModel> {
  try {
    const id = `PM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await query<any>(
      `INSERT INTO pricing_models (
        id, code, name, billing_basis, currency, unit_price, min_units, max_units, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        input.code,
        input.name,
        input.billingBasis,
        input.currency,
        input.unitPrice,
        input.minUnits || null,
        input.maxUnits || null,
        input.notes || null,
      ]
    );

    return rowToPricingModel(result.rows[0]);
  } catch (error) {
    console.error('Error creating pricing model:', error);
    throw error;
  }
}

export async function updatePricingModel(id: string, input: Partial<CreatePricingModelInput>): Promise<PricingModel | null> {
  try {
    const updates: string[] = [];
    const params: any[] = [id];
    let paramIndex = 2;

    if (input.code !== undefined) {
      updates.push(`code = $${paramIndex}`);
      params.push(input.code);
      paramIndex++;
    }
    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }
    if (input.billingBasis !== undefined) {
      updates.push(`billing_basis = $${paramIndex}`);
      params.push(input.billingBasis);
      paramIndex++;
    }
    if (input.currency !== undefined) {
      updates.push(`currency = $${paramIndex}`);
      params.push(input.currency);
      paramIndex++;
    }
    if (input.unitPrice !== undefined) {
      updates.push(`unit_price = $${paramIndex}`);
      params.push(input.unitPrice);
      paramIndex++;
    }
    if (input.minUnits !== undefined) {
      updates.push(`min_units = $${paramIndex}`);
      params.push(input.minUnits);
      paramIndex++;
    }
    if (input.maxUnits !== undefined) {
      updates.push(`max_units = $${paramIndex}`);
      params.push(input.maxUnits);
      paramIndex++;
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(input.notes || null);
      paramIndex++;
    }

    if (updates.length === 0) return getPricingModelById(id);

    updates.push(`updated_at = NOW()`);

    const result = await query<any>(
      `UPDATE pricing_models SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    return result.rows.length > 0 ? rowToPricingModel(result.rows[0]) : null;
  } catch (error) {
    console.error('Error updating pricing model:', error);
    throw error;
  }
}

export async function deletePricingModel(id: string): Promise<boolean> {
  try {
    const result = await query('DELETE FROM pricing_models WHERE id = $1', [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Error deleting pricing model:', error);
    throw error;
  }
}
