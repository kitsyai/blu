import * as React from 'react';
import { useResponsive } from "@kitsy/blu-context";
import { Navigate } from '@kitsy/blu-route';

interface ResponsiveAttributes {
    small: boolean;
    medium: boolean;
    large: boolean;
}

interface SlideAttributes {
  title: string;
  subtitle: string;
  image: string;
  href: string;
};

function MobileLayout({ title, subtitle, image, href }: SlideAttributes) {
  return (
    <div className="p-4">
      <div className="text-6xl my-8">{title}</div>
      <p className="text-slate-900 my-4">{subtitle}</p>
      <Navigate
        to={href}
        className="my-8 py-6 uppercase justify-center rounded-lg w-32 h-12 shadow-lg shadow-orange-500 text-white flex items-center bg-orange-600"
      >
        Read
      </Navigate>
    </div>
  );
}

function Slide({ title, subtitle, image, href }: SlideAttributes & ResponsiveAttributes) {
  return (
    <MobileLayout title={title} subtitle={subtitle} image={image} href={href} />
  );
}


interface CardAttributes {
    title: string;
    image: string;
    href: string;
    selected: boolean;
}

function Card({ image, title, href, selected }: CardAttributes) {
  return (
    <a
      href={href}
      className={`flex flex-col border ${selected ? "border-blue-500" : ""}`}
    >
      <img
        src={image}
        className="md:h-24 h-48 object-cover object-top"
        alt="javascript is dead"
      />
      <p className="hidden p-4 text-center"> {title}</p>
    </a>
  );
}

interface SlideListAttributes {
    activeIndex: number;
    data: {
      title: string;
      subtitle: string;
      image: string;
      href: string;
    }[];
}

function SlideList(props: SlideListAttributes) {
  const { activeIndex, data } = props;
  return (
    <ul className="flex m-4 space-x-2 justify-center">
      {data.map(({ title, image }, index) => (
        <li key={`${title}`}>
          <i
            className={`${
              activeIndex === index ? "fa-solid text-sm" : "fa-regular text-xs"
            } fa-circle`}
          />
          {/* <Card
            selected={activeIndex === index}
            title={title}
            url="/articles/ai-is-future"
            image={image}
          /> */}
        </li>
      ))}
    </ul>
  );
}

export interface CarouselAttributes {
    data: {
      title: string;
      subtitle: string;
      image: string;
      href: string;
    }[];
}

export function Carousel(props: CarouselAttributes) {
  const { data } = props;
  const { length } = data;
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [small, medium, large] = useResponsive();

  // console.log("small = ", small, ", medium = ", medium, ", large = ", large);

  React.useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveIndex((index) => (index + 1) % length);
    }, 6000);

    return () => {
      clearInterval(intervalId);
    };
  }, [length]);

  return (
    <div className="flex flex-col justify-around h-full">
      <SlideList data={data} activeIndex={activeIndex} />
      <Slide
        small={small}
        medium={medium}
        large={large}
        title={data[activeIndex].title}
        subtitle={data[activeIndex].subtitle}
        image={data[activeIndex].image}
        href={data[activeIndex].href}
      />
    </div>
  );
}

