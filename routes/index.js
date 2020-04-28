var path = require("path");
const { exec } = require("child_process");
var fs = require("fs").promises;
var express = require("express");
var router = express.Router();

const getProxies = async () => {
  const fileContent = await fs.readFile(
    path.join("/etc/nginx/nginx.conf"),
    "utf8"
  );
  const found = fileContent.match(
    /# start proxies-list([\s\S]*)# end proxies-list/i
  );
  let proxies;
  if (found) {
    proxies = found[1];
  }

  const locationRegex = /location\s*([=\^\~\* ]*\/\S*)\s*\{\s*proxy_pass\s*(\S+);[^\}]*\}/gi;
  let matched;
  const locations = [];
  while ((matched = locationRegex.exec(proxies))) {
    const obj = {
      path: matched[1],
      proxyUrl: matched[2],
    };
    locations.push(obj);
  }
  return locations;
};

/* GET home page. */
router.get("/", async function (req, res, next) {
  const locations = await getProxies();
  console.log(locations);
  res.render("index", {
    title: "Reverse Proxies",
    locations,
  });
});

router.post("/", async (req, res) => {
  const fileContent = await fs.readFile(
    path.join("/etc/nginx/nginx.conf"),
    "utf8"
  );
  const regexToReplace = /# start proxies-list([\s\S]*)# end proxies-list/i;
  const text = req.body.locations.map((location) => {
    return `\t\tlocation ${location.path} {\n\t\t\tproxy_pass\t${location.proxyUrl};\n\t\t}`;
  });
  const replacementText = `# start proxies-list\n${text.join(
    "\n\n"
  )}\n\t\t# end proxies-list`;
  const newText = fileContent.replace(regexToReplace, replacementText);
  await fs.writeFile(path.join("/etc/nginx/nginx.conf"), newText, "utf8");
  exec("systemctl restart nginx");
  res.send("success!");
});

module.exports = router;
