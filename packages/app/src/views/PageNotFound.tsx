import * as React from "react";
import { Button, NavBar, AppBar } from "@kitsy/blu-ui";
import { Container, Section } from "@kitsy/blu-core";
import { useApplicationContext } from "@kitsy/blu-context";
import { View } from "@/@types/View";

interface DefaultComponentViewAttributes {
  view: View;
  children: React.ReactNode;
}

export function PageNotFound({
  children,
  view,
}: DefaultComponentViewAttributes) {
  // const navigation = useNavigation();
  // const view = useView();
  // const appbar = useAppBar();
  // const { value, topNav, appBar } = useApplicationContext();

  // useEffect(() => {
  //     document.title = view.meta?.title || "";
  // }, [])

  /**
   * <Navigation />
   * <View />
   * <AppBar />
   * <Footer />
   */
  return (
    <>
      <div className="flex flex-col h-screen justify-center">
        <Container>
          <Section
            style={{ height: "calc(100vh - 200px)", marginBottom: "100px" }}
          >
            Page not found
          </Section>
        </Container>
      </div>
    </>
  );
}
