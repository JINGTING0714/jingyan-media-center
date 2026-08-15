export default async function handler(request) {

  return new Response(
    JSON.stringify({
      status:"api-ready",
      message:"upload system online"
    }),
    {
      headers:{
        "content-type":"application/json"
      }
    }
  );

}
