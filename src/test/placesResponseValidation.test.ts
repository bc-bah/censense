import { describe, expect, it } from 'vitest';
import { parsePlacesRows } from '../census/placesResponseValidation';

describe('CDC PLACES response validation', () => {
  it('maps valid records', () => {
    const payload = [{ locationid: '51059', locationname: 'Fairfax', data_value: '10.2', measureid: 'DIABETES' }];
    expect(parsePlacesRows(payload)).toEqual([{ locationid: '51059', locationname: 'Fairfax', data_value: '10.2', measureid: 'DIABETES', data_value_type: undefined }]);
  });
  it('rejects a response that is not an array', () => {
    expect(() => parsePlacesRows({})).toThrow(/not an array/);
  });
  it('rejects records missing required fields', () => {
    expect(() => parsePlacesRows([{ locationid: '51059', locationname: 'Fairfax' }])).toThrow(/missing required field/);
  });
});
