import sys
import re

# Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    idx_content = f.read()

idx_content = idx_content.replace('<a href="#" class="btn-outline btn-lg" id="hero-demo">', '<a href="book-demo.html" class="btn-outline btn-lg" id="hero-demo">')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(idx_content)

# Update book-demo.html
with open('book-demo.html', 'r', encoding='utf-8') as f:
    demo_lines = f.readlines()

# find start and end of main content
start_idx = -1
end_idx = -1
for i, line in enumerate(demo_lines):
    if '<!-- ============ PRICING HERO ============ -->' in line:
        start_idx = i
    if '<!-- ============ FOOTER ============ -->' in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    new_content = demo_lines[:start_idx] + [
        '  <!-- ============ DEMO BOOKING HERO ============ -->\n',
        '  <section class="pricing-hero">\n',
        '    <div class="pricing-hero-glow"></div>\n',
        '    <div class="container pricing-hero-inner">\n',
        '      <div class="badge" style="margin: 0 auto 20px;">\n',
        '        <span class="badge-dot"></span>\n',
        '        Get a Personalized Tour\n',
        '      </div>\n',
        '      <h1>Book a Demo</h1>\n',
        '      <p>See how EnviGuide IHM can simplify your fleet\'s compliance and hazardous material management.</p>\n',
        '    </div>\n',
        '  </section>\n\n',
        '  <!-- ============ BOOKING FORM ============ -->\n',
        '  <section style="padding: 96px 0; background: var(--off-white); position: relative; z-index: 10; margin-top: -60px;">\n',
        '    <div class="container" style="max-width: 600px; background: var(--white); border: 1px solid var(--gray-200); border-radius: var(--radius-xl); padding: 48px; box-shadow: var(--shadow-lg);">\n',
        '      <h2 style="font-size: 1.5rem; margin-bottom: 24px; text-align: center;">Schedule Your Session</h2>\n',
        '      <form action="#" method="POST" style="display: flex; flex-direction: column; gap: 20px;">\n',
        '        <div>\n',
        '          <label for="name" style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); margin-bottom: 8px;">Full Name</label>\n',
        '          <input type="text" id="name" name="name" required style="width: 100%; padding: 12px 16px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 1rem; color: var(--gray-900); font-family: \'Inter\', sans-serif;">\n',
        '        </div>\n',
        '        <div>\n',
        '          <label for="email" style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); margin-bottom: 8px;">Work Email</label>\n',
        '          <input type="email" id="email" name="email" required style="width: 100%; padding: 12px 16px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 1rem; color: var(--gray-900); font-family: \'Inter\', sans-serif;">\n',
        '        </div>\n',
        '        <div>\n',
        '          <label for="company" style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); margin-bottom: 8px;">Company / Fleet Name</label>\n',
        '          <input type="text" id="company" name="company" required style="width: 100%; padding: 12px 16px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 1rem; color: var(--gray-900); font-family: \'Inter\', sans-serif;">\n',
        '        </div>\n',
        '        <div>\n',
        '          <label for="date" style="display: block; font-size: 0.85rem; font-weight: 600; color: var(--gray-700); margin-bottom: 8px;">Preferred Date</label>\n',
        '          <input type="date" id="date" name="date" required style="width: 100%; padding: 12px 16px; border: 1px solid var(--gray-300); border-radius: var(--radius-md); font-size: 1rem; color: var(--gray-900); font-family: \'Inter\', sans-serif;">\n',
        '        </div>\n',
        '        <div style="margin-top: 12px;">\n',
        '          <button type="submit" class="btn-primary btn-lg" style="width: 100%; justify-content: center;">Confirm Booking</button>\n',
        '        </div>\n',
        '      </form>\n',
        '    </div>\n',
        '  </section>\n\n'
    ] + demo_lines[end_idx:]

    final_content = "".join(new_content)
    final_content = re.sub(r'<!-- ---- Annual/Monthly Toggle ---- -->.*?<\/script>', '</script>', final_content, flags=re.DOTALL)
    final_content = final_content.replace('<title>Pricing — EnviGuide IHM</title>', '<title>Book a Demo — EnviGuide IHM</title>')
    # also remove pricing specific script tags
    final_content = final_content.replace('    /* ---- Annual/Monthly Toggle ---- */', '')
    final_content = re.sub(r'\(function \(\) \{.*?\}\)\(\);', '', final_content, flags=re.DOTALL)
    
    # Change active nav link logic
    final_content = final_content.replace('id="nav-pricing" class="nav-link plain active-page"', 'id="nav-pricing" class="nav-link plain"')
    final_content = final_content.replace('class="nav-link plain active-page" id="nav-pricing"', 'class="nav-link plain" id="nav-pricing"')
    
    with open('book-demo.html', 'w', encoding='utf-8') as f:
        f.write(final_content)
    print('Updated book-demo.html and index.html')
else:
    print('Could not find markers in book-demo.html')
