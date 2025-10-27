import axios from 'axios';

export const callGraphQLApi = async (query: object) => {
  const options = {
    method: 'POST',
    url: `${process.env.TWENTY_API_URL}/graphql`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TWENTY_API_KEY}`,
    },
    data: query,
  };

  const { data } = await axios.request(options);

  return data;
};
