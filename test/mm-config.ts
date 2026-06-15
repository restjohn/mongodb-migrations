import _ from 'lodash';
import { config } from './common';

export = _.assign({}, config, {
  directory: 'created-migrations',
});
