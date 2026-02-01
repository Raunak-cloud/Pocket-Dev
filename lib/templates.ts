export interface WebsiteTemplate {
  id: string;
  type: "business" | "ecommerce";
  description: string;
  features: string[];
  htmlContent: string;
  author: string;
}

const businessTemplate: WebsiteTemplate = {
  id: "template-business",
  type: "business",
  description:
    "Professional business website template with hero section, services showcase, team information, and contact form. Perfect for consultants, agencies, and service-based companies.",
  features: [
    "Hero Section",
    "Services Showcase",
    "Team Section",
    "Contact Form",
    "Professional Design",
  ],
  author: "Template Team",
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Professional Business</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 0;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
    }
    nav ul {
      list-style: none;
      display: flex;
      gap: 30px;
    }
    nav a {
      color: white;
      text-decoration: none;
      transition: opacity 0.3s;
    }
    nav a:hover {
      opacity: 0.8;
    }
    .hero {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 100px 0;
      text-align: center;
    }
    .hero h1 {
      font-size: 48px;
      margin-bottom: 20px;
    }
    .hero p {
      font-size: 20px;
      margin-bottom: 30px;
      opacity: 0.9;
    }
    .cta-button {
      background: white;
      color: #667eea;
      padding: 12px 30px;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.3s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
    }
    .services {
      padding: 80px 0;
      background: #f9f9f9;
    }
    .services h2 {
      text-align: center;
      font-size: 36px;
      margin-bottom: 50px;
      color: #333;
    }
    .services-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 30px;
    }
    .service-card {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      transition: transform 0.3s;
    }
    .service-card:hover {
      transform: translateY(-5px);
    }
    .service-card h3 {
      color: #667eea;
      margin-bottom: 15px;
      font-size: 22px;
    }
    .service-card p {
      color: #666;
      line-height: 1.8;
    }
    .team {
      padding: 80px 0;
    }
    .team h2 {
      text-align: center;
      font-size: 36px;
      margin-bottom: 50px;
      color: #333;
    }
    .team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
    }
    .team-member {
      text-align: center;
      padding: 20px;
    }
    .team-member img {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      object-fit: cover;
      margin-bottom: 15px;
      background: #ddd;
    }
    .team-member h3 {
      color: #333;
      margin-bottom: 5px;
    }
    .team-member p {
      color: #666;
      font-size: 14px;
    }
    footer {
      background: #333;
      color: white;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <header>
    <nav class="container">
      <div class="logo">Business Co.</div>
      <ul>
        <li><a href="#services">Services</a></li>
        <li><a href="#team">Team</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <section class="hero">
    <div class="container">
      <h1>Professional Solutions for Your Business</h1>
      <p>We deliver exceptional results through innovation and expertise</p>
      <button class="cta-button">Get Started Today</button>
    </div>
  </section>

  <section class="services" id="services">
    <div class="container">
      <h2>Our Services</h2>
      <div class="services-grid">
        <div class="service-card">
          <h3>Consulting</h3>
          <p>Strategic business consulting to help you achieve your goals and overcome challenges with expert guidance.</p>
        </div>
        <div class="service-card">
          <h3>Development</h3>
          <p>Custom software and web development tailored to your specific business needs and requirements.</p>
        </div>
        <div class="service-card">
          <h3>Support</h3>
          <p>24/7 dedicated support to ensure your systems run smoothly and efficiently at all times.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="team" id="team">
    <div class="container">
      <h2>Meet Our Team</h2>
      <div class="team-grid">
        <div class="team-member">
          <div style="width: 150px; height: 150px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 15px;"></div>
          <h3>Sarah Johnson</h3>
          <p>CEO & Founder</p>
        </div>
        <div class="team-member">
          <div style="width: 150px; height: 150px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 50%; margin: 0 auto 15px;"></div>
          <h3>Michael Chen</h3>
          <p>Lead Developer</p>
        </div>
        <div class="team-member">
          <div style="width: 150px; height: 150px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 50%; margin: 0 auto 15px;"></div>
          <h3>Emily Rodriguez</h3>
          <p>Design Director</p>
        </div>
      </div>
    </div>
  </section>

  <footer id="contact">
    <div class="container">
      <p>&copy; 2024 Business Co. All rights reserved. | <a href="mailto:info@business.com" style="color: white; text-decoration: none;">info@business.com</a></p>
    </div>
  </footer>
</body>
</html>`,
};

const ecommerceTemplate: WebsiteTemplate = {
  id: "template-ecommerce",
  type: "ecommerce",
  description:
    "Modern ecommerce store template featuring product showcase, shopping cart, banner promotions, and checkout. Ideal for online retailers and digital product sellers.",
  features: [
    "Product Showcase",
    "Shopping Cart",
    "Promotions Banner",
    "Search Functionality",
    "Responsive Design",
  ],
  author: "Template Team",
  htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern Shop</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    header {
      background: white;
      border-bottom: 1px solid #eee;
      padding: 15px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #ff6b35;
    }
    .search-bar {
      flex: 1;
      margin: 0 30px;
      display: flex;
    }
    .search-bar input {
      width: 100%;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .cart-icon {
      position: relative;
      cursor: pointer;
      font-size: 24px;
    }
    .banner {
      background: linear-gradient(90deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      padding: 40px 0;
      text-align: center;
      margin-bottom: 40px;
    }
    .banner h2 {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .banner p {
      font-size: 18px;
      opacity: 0.9;
    }
    .products {
      padding: 40px 0;
    }
    .products h2 {
      font-size: 28px;
      margin-bottom: 30px;
      color: #333;
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 25px;
    }
    .product-card {
      background: white;
      border: 1px solid #eee;
      border-radius: 8px;
      overflow: hidden;
      transition: box-shadow 0.3s, transform 0.3s;
      cursor: pointer;
    }
    .product-card:hover {
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
      transform: translateY(-5px);
    }
    .product-image {
      width: 100%;
      height: 250px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
    .product-info {
      padding: 20px;
    }
    .product-name {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #333;
    }
    .product-description {
      color: #666;
      font-size: 14px;
      margin-bottom: 12px;
      line-height: 1.5;
    }
    .product-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .price {
      font-size: 24px;
      font-weight: bold;
      color: #ff6b35;
    }
    .add-to-cart {
      background: #ff6b35;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.3s;
    }
    .add-to-cart:hover {
      background: #f7931e;
    }
    .footer {
      background: #f9f9f9;
      padding: 40px 0;
      margin-top: 60px;
    }
    .footer-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
      margin-bottom: 20px;
    }
    .footer-section h4 {
      margin-bottom: 15px;
      color: #333;
    }
    .footer-section ul {
      list-style: none;
    }
    .footer-section ul li {
      margin-bottom: 8px;
    }
    .footer-section a {
      color: #666;
      text-decoration: none;
      transition: color 0.3s;
    }
    .footer-section a:hover {
      color: #ff6b35;
    }
    .footer-bottom {
      text-align: center;
      border-top: 1px solid #ddd;
      padding-top: 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <nav class="container">
      <div class="logo">ShopHub</div>
      <div class="search-bar">
        <input type="text" placeholder="Search for products...">
      </div>
      <div class="cart-icon">🛒</div>
    </nav>
  </header>

  <section class="banner">
    <div class="container">
      <h2>Summer Sale - Up to 50% Off!</h2>
      <p>Shop the latest collections and save big on your favorite items</p>
    </div>
  </section>

  <section class="products">
    <div class="container">
      <h2>Featured Products</h2>
      <div class="product-grid">
        <div class="product-card">
          <div class="product-image">Product Image 1</div>
          <div class="product-info">
            <div class="product-name">Premium Headphones</div>
            <div class="product-description">High-quality audio with noise cancellation</div>
            <div class="product-footer">
              <span class="price">$199.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="product-card">
          <div class="product-image">Product Image 2</div>
          <div class="product-info">
            <div class="product-name">Wireless Speaker</div>
            <div class="product-description">Portable and powerful sound anywhere</div>
            <div class="product-footer">
              <span class="price">$129.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="product-card">
          <div class="product-image">Product Image 3</div>
          <div class="product-info">
            <div class="product-name">Smart Watch</div>
            <div class="product-description">Track fitness and stay connected</div>
            <div class="product-footer">
              <span class="price">$299.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="product-card">
          <div class="product-image">Product Image 4</div>
          <div class="product-info">
            <div class="product-name">USB-C Cable</div>
            <div class="product-description">Fast charging and data transfer</div>
            <div class="product-footer">
              <span class="price">$19.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="product-card">
          <div class="product-image">Product Image 5</div>
          <div class="product-info">
            <div class="product-name">Phone Stand</div>
            <div class="product-description">Adjustable and stable viewing angle</div>
            <div class="product-footer">
              <span class="price">$24.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
        <div class="product-card">
          <div class="product-image">Product Image 6</div>
          <div class="product-info">
            <div class="product-name">Screen Protector</div>
            <div class="product-description">Tempered glass protection for any device</div>
            <div class="product-footer">
              <span class="price">$14.99</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-section">
          <h4>Shop</h4>
          <ul>
            <li><a href="#">New Arrivals</a></li>
            <li><a href="#">Best Sellers</a></li>
            <li><a href="#">On Sale</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4>Support</h4>
          <ul>
            <li><a href="#">Contact Us</a></li>
            <li><a href="#">Shipping Info</a></li>
            <li><a href="#">Returns</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4>About</h4>
          <ul>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Blog</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2024 ShopHub. All rights reserved. | <a href="#" style="color: #ff6b35; text-decoration: none;">Privacy Policy</a></p>
      </div>
    </div>
  </footer>
</body>
</html>`,
};

export const allTemplates: WebsiteTemplate[] = [
  businessTemplate,
  ecommerceTemplate,
];
