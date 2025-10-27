import axios from 'axios';

export const callRestApi = async ({
  httpMethod,
  payload,
  url,
}: {
  httpMethod: 'GET' | 'POST';
  payload?: any;
  url: string;
}) => {
  const options = {
    method: httpMethod,
    url: `${process.env.TWENTY_API_URL}/${url}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TWENTY_API_KEY}`,
    },
    data: payload,
  };

  const { data } = await axios.request(options);

  return data;
};
