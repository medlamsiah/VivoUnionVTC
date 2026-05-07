import Image from "next/image";

export function AvatarGroup({ size = 34 }: { size?: number }) {
  const avatars = [
    { src: "/avatars/a1.png", alt: "Chauffeur 1" },
    { src: "/avatars/a2.png", alt: "Chauffeur 2" },
    { src: "/avatars/a3.png", alt: "Chauffeur 3" },
  ];

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {avatars.map((a) => (
          <div
            key={a.src}
            className="relative rounded-full ring-2 ring-white/30"
            style={{ width: size, height: size }}
          >
            <Image src={a.src} alt={a.alt} fill className="rounded-full object-cover" />
          </div>
        ))}
      </div>
      <div className="text-sm text-white/85">
        <span className="font-semibold text-white">Rejoignez 1000+ chauffeurs</span>
      </div>
    </div>
  );
}
