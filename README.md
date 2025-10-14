# Pangolin Remote Node

A remote node for Pangolin to support scaling and HA. This container serves as a lightweight wrapper for the API calls made by both Badger and Gerbil into a Pangolin node. Instead of communicating with a local instance of Pangolin, it instead proxies those requests to a remote Pangolin head server. 

Remote nodes are used with the Pangolin Cloud and Pangolin Enterprise.

Take a look at the [docs](https://docs.digpangolin.com/) for more information on Pangolin Remote Nodes.

For the Pangolin repository, see [here](https://github.com/fosrl/pangolin).