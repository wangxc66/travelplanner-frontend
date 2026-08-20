const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use(
    createProxyMiddleware({
      pathFilter: '/api/ai',
      target: 'http://localhost:5001',
      changeOrigin: true,
    })
  );

  app.use(
    createProxyMiddleware({
      pathFilter: ['/api', '/auth'],
      target: 'http://localhost:8080',
      changeOrigin: true,
    })
  );
};
