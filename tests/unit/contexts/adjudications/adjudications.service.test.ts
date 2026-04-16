import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AdjudicationsService source regression', () => {
  const servicePath = join(process.cwd(), 'src', 'contexts', 'adjudications', 'adjudications.service.ts');
  const source = readFileSync(servicePath, 'utf8');

  it('uses only real columns in the search clause', () => {
    expect(source).toContain(
      "(adjudication.id::text ILIKE :search OR licitation.callNumber ILIKE :search OR licitation.internalNumber ILIKE :search OR client.name ILIKE :search)"
    );
    expect(source).not.toContain('adjudication.clientName');
  });

  it('keeps the combined filters for status, quotation, licitation and product', () => {
    expect(source).toContain("queryBuilder.andWhere('adjudication.status = :status', { status });");
    expect(source).toContain("queryBuilder.andWhere('adjudication.quotationId = :quotationId', { quotationId });");
    expect(source).toContain("queryBuilder.andWhere('adjudication.licitationId = :licitationId', { licitationId });");
    expect(source).toContain("queryBuilder.andWhere('items.productId = :productId', { productId });");
  });

  it('ensures findOne method includes licitation in relations', () => {
    // Find the findOne method content
    const findOneMatch = source.match(/async findOne\(id: number\): Promise<Adjudication> {([\s\S]*?)return adjudication;/);
    expect(findOneMatch).not.toBeNull();
    const findOneContent = findOneMatch![1];
    expect(findOneContent).toContain("relations: ['items', 'licitation']");
  });
});
