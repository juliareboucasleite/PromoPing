const fs = require('fs');
const path = '/root/PromoPing/.env';
let content = fs.readFileSync(path, 'utf8');
const vars = {
  PRODUCT_NAME: 'SpotiCat',
  PRODUCT_SLUG: 'spotcat',
  PRODUCT_PRICE: '$5 USD',
  PRODUCT_PAYMENT_URL: 'https://checkout.revolut.com/pay/c5c358ec-9ee9-4b01-b9d3-514e82ce70f7',
  PRODUCT_REVIEWER_ROLE_IDS: '1514462155167105114,1514436077979566131',
};
for (const [key, value] of Object.entries(vars)) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content) ? content.replace(re, line) : `${content.trimEnd()}\n${line}\n`;
}
fs.writeFileSync(path, content);
console.log(content.split('\n').filter((l) => l.startsWith('PRODUCT_')).join('\n'));
