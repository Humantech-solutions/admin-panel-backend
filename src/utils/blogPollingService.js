const SentNotification = require('../models/sentNotificationModel');
const Website = require('../models/websiteModel');
const Subscription = require('../models/subscriptionModel');
const Company = require('../models/companyModel');
const { sendEmail } = require('../utils/emailUtil');

const IPUBLISH_API_URL = "https://apis.ipublish.hutechsolutions.ai/api/v1/content/published";
const IPUBLISH_STATIC_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NzUwYmFlYy1lOTllLTRkYzAtOTM5Yy1hYTVjMWQ1MGFhNWYiLCJvcmdfaWQiOiI0ZjdlYmE4YS05OGZjLTQyODEtODJjZi1jYmM4YzIwZmY0NWUifQ.nkv7ZboCMX2BzwTt_r1F2t_IGAiFi1bcwpexyPBDxfQ";
const WP_API_URL = "https://cms.hutechsolutions.ai/wp-json/wp/v2/posts?_embed&per_page=10";

async function checkIPublishBlogs() {
  try {
    const res = await fetch(IPUBLISH_API_URL, {
      headers: { "Authorization": "Bearer " + IPUBLISH_STATIC_TOKEN, "Content-Type": "application/json" }
    });
    if (!res.ok) return;
    const blogs = await res.json();
    if (!Array.isArray(blogs)) return;

    for (const blog of blogs) {
      if (!blog.id || !blog.title) continue;
      
      const exists = await SentNotification.findOne({ blogId: blog.id, source: 'ipublish' });
      if (!exists) {
        // Find respective websites from destinations array
        if (Array.isArray(blog.destinations) && blog.destinations.length > 0) {
          for (const dest of blog.destinations) {
            if (!dest.domain) continue;
            // Remove 'www.' from domain to match CRM website model
            const cleanDomain = dest.domain.replace(/^www\./i, '');
            
            const website = await Website.findOne({ 
              $or: [
                { url: { $regex: cleanDomain, $options: 'i' } },
                { name: { $regex: cleanDomain.split('.')[0], $options: 'i' } }
              ] 
            }).populate('companyId');
            
            if (website) {
              await notifySubscribers({
                title: blog.title,
                url: `https://${dest.domain}/resources/blogs/ipublish/${blog.slug}`,
                excerpt: blog.excerpt || blog.summary || '',
                website
              });
            }
          }
        } else {
          // Fallback if no destination, default to Hutech
          const website = await Website.findOne({ url: { $regex: 'hutechsolutions' } }).populate('companyId');
          if (website) {
            await notifySubscribers({
              title: blog.title,
              url: `https://hutechsolutions.ai/resources/blogs/ipublish/${blog.slug}`,
              excerpt: blog.excerpt || blog.summary || '',
              website
            });
          }
        }
        await SentNotification.create({ blogId: blog.id, source: 'ipublish' });
      }
    }
  } catch (err) {
    console.error("[Polling] Error checking iPublish:", err);
  }
}

async function checkWordPressBlogs() {
  try {
    const res = await fetch(WP_API_URL);
    if (!res.ok) return;
    const posts = await res.json();
    if (!Array.isArray(posts)) return;

    for (const post of posts) {
      if (!post.id || !post.title || !post.title.rendered) continue;
      
      const exists = await SentNotification.findOne({ blogId: post.id.toString(), source: 'wordpress' });
      if (!exists) {
        // WordPress currently serves hutechsolutions, so defaulting to it
        const website = await Website.findOne({ url: { $regex: 'hutechsolutions' } }).populate('companyId');
        if (website) {
          await notifySubscribers({
            title: post.title.rendered,
            url: "https://hutechsolutions.ai/resources/blogs/" + post.slug,
            excerpt: post.excerpt && post.excerpt.rendered ? post.excerpt.rendered.replace(/<[^>]*>?/gm, '') : '',
            website
          });
        }
        await SentNotification.create({ blogId: post.id.toString(), source: 'wordpress' });
      }
    }
  } catch (err) {
    console.error("[Polling] Error checking WordPress:", err);
  }
}

async function notifySubscribers({ title, url, excerpt, website }) {
  const company = website.companyId;
  if (!company) return;

  const subscribers = await Subscription.find({ websiteId: website._id, isActive: true });
  for (const sub of subscribers) {
    const unsubscribeUrl = (process.env.BACKEND_URL || 'https://apis.admin.hutechsolutions.in') + '/api/subscriptions/unsubscribe?email=' + encodeURIComponent(sub.email) + '&websiteId=' + website._id;
    
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eaeaea;">
        <!-- Header -->
        <div style="background-color: #11253e; padding: 30px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${company.name}</h1>
          <p style="color: #8fa0b5; margin: 5px 0 0 0; font-size: 14px;">Latest Insights & Updates</p>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #11253e; margin-top: 0; font-size: 22px; line-height: 1.4;">${title}</h2>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #f99d1c; padding: 15px 20px; margin: 20px 0; color: #475569; font-size: 15px; line-height: 1.6; border-radius: 0 4px 4px 0;">
            ${excerpt || "We just published a new article that we think you'll find interesting. Click below to read the full details and stay updated with our latest industry insights."}
          </div>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${url}" style="display: inline-block; padding: 14px 30px; background-color: #f99d1c; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; transition: background-color 0.3s;">
              Read Full Article
            </a>
          </div>
          
          <!-- Useful Links -->
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            <h4 style="color: #11253e; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; text-align: center;">Quick Links</h4>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
              <tr>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/services" style="color: #2563eb; text-decoration: none; font-weight: 500;">Our Services</a>
                </td>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/case-studies" style="color: #2563eb; text-decoration: none; font-weight: 500;">Case Studies</a>
                </td>
                <td width="33%" align="center">
                  <a href="https://hutechsolutions.ai/contact" style="color: #2563eb; text-decoration: none; font-weight: 500;">Contact Us</a>
                </td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #eaeaea;">
          <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
            You received this email because you are subscribed to ${company.name} newsletters.<br>
            To stop receiving these emails, <a href="${unsubscribeUrl}" style="color: #f99d1c; text-decoration: underline;">click here to unsubscribe</a>.
          </p>
        </div>
      </div>
    `;
    
    await sendEmail({
      to: sub.email,
      fromName: company.name,
      subject: "New Post: " + title,
      html
    }).catch(e => console.error("Email send failed:", e));
  }
}

function startPolling() {
  console.log("Starting blog polling service...");
  setInterval(() => {
    checkIPublishBlogs();
    checkWordPressBlogs();
  }, 2 * 60 * 1000);
  
  setTimeout(() => {
    checkIPublishBlogs();
    checkWordPressBlogs();
  }, 5000);
}

module.exports = { startPolling };
